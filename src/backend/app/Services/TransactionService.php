<?php

namespace App\Services;

use App\Models\ApplianceRate;
use App\Models\Meter\Meter;
use App\Models\Transaction\Transaction;
use App\Services\Interfaces\IAssociative;
use App\Services\Interfaces\IBaseService;
use App\Traits\HasCrudOperations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * @implements IAssociative<Transaction>
 * @implements IBaseService<Transaction>
 */
class TransactionService implements IAssociative, IBaseService {
    /** @use HasCrudOperations<Transaction> */
    use HasCrudOperations;

    public const YESTERDAY = 0;
    public const SAME_DAY_LAST_WEEK = 1;
    public const LAST_SEVEN_DAYS = 2;
    public const LAST_THIRTY_DAYS = 3;

    public const PERCENTAGE_DIVIDER = 100;

    /** Payment providers record a confirmed payment as 1 (success) or 2 (completed). */
    private const array CONFIRMED_STATUSES = [1, 2];

    /** -1 is a rejected payment and 3 one the payer abandoned. */
    private const array CANCELLED_STATUSES = [-1, 3];

    /**
     * The list shows who paid, so the device's owner comes along with each row.
     *
     * @var array<int|string, mixed>
     */
    private const array LIST_RELATIONS = ['originalTransaction', 'device.person:id,name,surname'];

    public function __construct(
        private Transaction $transaction,
    ) {}

    protected function crudModel(): Transaction {
        return $this->transaction;
    }

    /**
     * @param array<int> $transactionIds
     */
    private function getTotalAmountOfConfirmedTransaction($transactionIds): float {
        return (float) $this->transaction->newQuery()->whereHasMorph(
            'originalTransaction',
            '*',
            static fn ($q) => $q->whereIn('status', self::CONFIRMED_STATUSES)
        )
            ->whereIn('id', $transactionIds)
            ->sum('amount');
    }

    /**
     * @param array<int> $transactionIds
     * @param array<int> $statuses
     */
    private function countWithStatus(array $transactionIds, array $statuses): int {
        return $this->transaction->newQuery()->whereHasMorph(
            'originalTransaction',
            '*',
            static fn ($q) => $q->whereIn('status', $statuses)
        )
            ->whereIn('id', $transactionIds)
            ->count();
    }

    private function getPercentage(int $base, int $wanted, bool $baseShouldGreater = true): float {
        if ($base === 0 || $wanted === 0) {
            return 0;
        }

        $percentage = (float) $wanted * self::PERCENTAGE_DIVIDER / (float) $base;

        if ($baseShouldGreater) {
            return round(100 - $percentage, 2);
        }

        return round($percentage - 100, 2);
    }

    /**
     * @return Collection<int, Transaction>|LengthAwarePaginator<int, Transaction>
     */
    public function search(
        ?string $deviceType = 'all',
        ?string $serialNumber = null,
        ?int $tariffId = null,
        ?string $transactionProvider = 'all',
        ?int $status = null,
        ?string $fromDate = null,
        ?string $toDate = null,
        ?int $limit = null,
    ): LengthAwarePaginator|Collection {
        $query = $this->transaction->newQuery()->with(self::LIST_RELATIONS);

        if ($deviceType !== 'all') {
            $query->whereHas(
                'device',
                fn ($q) => $q->whereHasMorph('device', $deviceType)
            );
        }

        if ($serialNumber) {
            $query->where('message', 'LIKE', '%'.$serialNumber.'%');
        }

        // Tariffs only exist for meters.
        if ($tariffId) {
            $query->whereHas(
                'device',
                fn ($q) => $q->whereHasMorph('device', Meter::class, fn ($q) => $q->where('tariff_id', $tariffId))
            );
        }

        if ($transactionProvider !== 'all') {
            $query->where(fn ($q) => $q->whereHasMorph('originalTransaction', $transactionProvider, fn ($q) => $q->whereNotNull('id')));
        }

        if ($status !== null) {
            $query->whereHasMorph(
                'originalTransaction',
                ($transactionProvider !== 'all') ? $transactionProvider : '*',
                fn ($q) => $q->where('status', $status)
            );
        }

        if ($fromDate) {
            $query->where('created_at', '>=', $fromDate);
        }

        if ($toDate) {
            $query->where('created_at', '<=', $this->endOfDayWhenDateOnly($toDate));
        }

        return $this->sortedListOf($query, $limit);
    }

    /**
     * A plain date such as 2026-10-31 would compare as midnight and leave out the whole day.
     */
    private function endOfDayWhenDateOnly(string $date): string {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1 ? $date.' 23:59:59' : $date;
    }

    /**
     * @param Builder<Transaction> $query
     *
     * @return Collection<int, Transaction>|LengthAwarePaginator<int, Transaction>
     */
    private function sortedListOf(Builder $query, ?int $limit): LengthAwarePaginator|Collection {
        $sorted = QueryBuilder::for($query)
            ->allowedSorts(['id', 'created_at', 'amount', 'sender', 'message', 'original_transaction_type'])
            ->defaultSort('-created_at');

        $list = $limit ? $sorted->paginate($limit) : $sorted->get();
        $rows = $list instanceof LengthAwarePaginator ? $list->getCollection() : $list;
        // A person appends `is_active`, which loads their latest payment: one query per row for a
        // value the list never shows.
        $rows->each(fn (Transaction $transaction) => $transaction->device?->person?->setAppends([]));

        return $list;
    }

    /**
     * Whole days that ended before today, so a period is never compared while it is still running.
     *
     * @return array<string, array<string, string>>|null
     */
    public function determinePeriod(int $period): ?array {
        $yesterday = CarbonImmutable::yesterday();

        return match ($period) {
            self::YESTERDAY => $this->comparison($yesterday, $yesterday, $yesterday->subDay(), $yesterday->subDay()),
            self::SAME_DAY_LAST_WEEK => $this->comparison($yesterday, $yesterday, $yesterday->subWeek(), $yesterday->subWeek()),
            self::LAST_SEVEN_DAYS => $this->comparison($yesterday->subDays(6), $yesterday, $yesterday->subDays(13), $yesterday->subDays(7)),
            self::LAST_THIRTY_DAYS => $this->comparison($yesterday->subDays(29), $yesterday, $yesterday->subDays(59), $yesterday->subDays(30)),
            default => null,
        };
    }

    /**
     * @return array<string, array<string, string>>
     */
    private function comparison(
        CarbonImmutable $currentFirstDay,
        CarbonImmutable $currentLastDay,
        CarbonImmutable $lastFirstDay,
        CarbonImmutable $lastLastDay,
    ): array {
        return [
            'currentPeriod' => [
                'begins' => $currentFirstDay->format('Y-m-d 00:00:00'),
                'ends' => $currentLastDay->format('Y-m-d 23:59:59'),
            ],
            'lastPeriod' => [
                'begins' => $lastFirstDay->format('Y-m-d 00:00:00'),
                'ends' => $lastLastDay->format('Y-m-d 23:59:59'),
            ],
        ];
    }

    /**
     * @param array<string, array<string, string>> $comparisonPeriod
     *
     * @return array<string, \Illuminate\Support\Collection<int, int>>
     */
    public function getByComparisonPeriod(array $comparisonPeriod): array {
        $currentTransactions = $this->transaction->newQuery()->whereBetween(
            'created_at',
            [
                $comparisonPeriod['currentPeriod']['begins'],
                $comparisonPeriod['currentPeriod']['ends'],
            ]
        )
            ->pluck('id');
        $pastTransactions = $this->transaction->newQuery()->whereBetween(
            'created_at',
            [
                $comparisonPeriod['lastPeriod']['begins'],
                $comparisonPeriod['lastPeriod']['ends'],
            ]
        )
            ->pluck('id');

        return [
            'current' => $currentTransactions,
            'past' => $pastTransactions,
        ];
    }

    /**
     * @param array<int> $transactionIds
     *
     * @return array<string, int|float>|null
     */
    public function getAnalysis($transactionIds): ?array {
        if (count($transactionIds) === 0) {
            return null;
        }

        $total = count($transactionIds);

        $amount = $this->getTotalAmountOfConfirmedTransaction($transactionIds);
        $confirmation = $this->countWithStatus($transactionIds, self::CONFIRMED_STATUSES);
        $cancellation = $this->countWithStatus($transactionIds, self::CANCELLED_STATUSES);

        $cancellationPercentage = $cancellation * self::PERCENTAGE_DIVIDER / $total;
        $confirmationPercentage = $confirmation * self::PERCENTAGE_DIVIDER / $total;

        return [
            'total' => $total,
            'amount' => $amount,
            'confirmed' => $confirmation,
            'confirmedPercentage' => $confirmationPercentage,
            'cancelled' => $cancellation,
            'cancelledPercentage' => $cancellationPercentage,
        ];
    }

    /**
     * @return array<string, int|float>
     */
    public function getEmptyCompareResult(): array {
        return [
            'total' => 0,
            'amount' => 0,
            'confirmed' => 0,
            'confirmedPercentage' => 0,
            'cancelled' => 0,
            'cancelledPercentage' => 0,
        ];
    }

    /**
     * @param array<string, int|float> $currentTransactions
     * @param array<string, int|float> $pastTransactions
     *
     * @return array<string, array<string, float|string>>
     */
    public function comparePeriods(array $currentTransactions, array $pastTransactions): array {
        $totalPercentage = $this->getPercentage($pastTransactions['total'], $currentTransactions['total'], false);
        $confirmationPercentage = round(
            $currentTransactions['confirmedPercentage'] - $pastTransactions['confirmedPercentage'],
            2
        );
        $cancellationPercentage = round(
            $currentTransactions['cancelledPercentage'] - $pastTransactions['cancelledPercentage'],
            2
        );
        $amountPercentage = $this->getPercentage($pastTransactions['amount'], $currentTransactions['amount'], false);

        return [
            'totalPercentage' => [
                'percentage' => $totalPercentage,
                'color' => $totalPercentage >= 0 ? 'green' : 'red',
            ],
            'confirmationPercentage' => [
                'percentage' => $confirmationPercentage,
                'color' => $confirmationPercentage >= 0 ? 'green' : 'red',
            ],
            'cancelationPercentage' => [
                'percentage' => $cancellationPercentage,
                'color' => $cancellationPercentage > 0 ? 'red' : 'green',
            ],
            'amountPercentage' => [
                'percentage' => $amountPercentage,
                'color' => $amountPercentage >= 0 ? 'green' : 'red',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $transactionData
     */
    public function make(array $transactionData): Transaction {
        return $this->transaction->newQuery()->make($transactionData);
    }

    public function save($transaction): bool {
        return $transaction->save();
    }

    public function getById(int $id): Transaction {
        $transaction = $this->transaction->newQuery()->with([
            'token',
            'originalTransaction',
            'originalTransaction.conflicts',
            'sms',
            'paymentHistories',
            'paymentHistories.paidFor',
            'device' => fn ($q) => $q->whereHas('person')->with(['device', 'person']),
        ])->find($id);

        // Load user relationship for cash transactions only
        if ($transaction && $transaction->original_transaction_type === 'cash_transaction') {
            $transaction->originalTransaction->load('user');
        }

        // For non-PAYGO appliances (no device), try to find the appliance through payment histories
        if ($transaction && !$transaction->device && !$transaction->appliance && $transaction->paymentHistories->isNotEmpty()) {
            $applianceRate = $transaction->paymentHistories
                ->filter(fn ($ph): bool => $ph->paid_for_type === ApplianceRate::class)
                ->first()?->paidFor;

            if ($applianceRate instanceof ApplianceRate) {
                $transaction->setRelation(
                    'appliance',
                    $applianceRate->appliancePerson()->with(['appliance', 'person'])->first()
                );
            }
        }

        return $transaction;
    }

    /**
     * @return Collection<int, Transaction>|LengthAwarePaginator<int, Transaction>
     */
    public function getAll(?int $limit = null): Collection|LengthAwarePaginator {
        return $this->sortedListOf($this->transaction->newQuery()->with(self::LIST_RELATIONS), $limit);
    }
}
