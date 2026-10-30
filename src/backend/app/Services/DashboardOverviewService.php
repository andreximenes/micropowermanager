<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\Transaction\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The figures a solar home system business watches: sales, money in, and how well installments are paid.
 * Each figure is one aggregate query over the live tables, so nothing needs caching or rebuilding.
 */
class DashboardOverviewService {
    public const PERIOD_THIS_MONTH = 'this_month';
    public const PERIOD_LAST_30_DAYS = 'last_30_days';
    public const PERIOD_LAST_3_MONTHS = 'last_3_months';
    public const PERIOD_THIS_YEAR = 'this_year';
    public const PERIODS = [
        self::PERIOD_THIS_MONTH,
        self::PERIOD_LAST_30_DAYS,
        self::PERIOD_LAST_3_MONTHS,
        self::PERIOD_THIS_YEAR,
    ];

    private const int MONTHS_OF_REVENUE = 12;
    private const int RECENT_SALES = 5;

    /** Payment providers record a confirmed payment as 1 (success) or 2 (completed). */
    private const array CONFIRMED_STATUSES = [1, 2];

    /** Each bucket's upper bound in days late; the last one is open-ended. */
    private const array OVERDUE_BUCKETS = ['1-30' => 30, '31-60' => 60, '61-90' => 90, '90+' => null];

    public function __construct(
        private Transaction $transaction,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getOverview(string $period, CarbonImmutable $today): array {
        [$from, $previousFrom, $previousTo] = $this->rangesOf($period, $today);
        $to = $today->endOfDay();

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $today->toDateString(),
                'previous_from' => $previousFrom->toDateString(),
                'previous_to' => $previousTo->toDateString(),
            ],
            'customers' => $this->customers($from, $to),
            'products_sold' => $this->productsSold($from, $to, $previousFrom, $previousTo),
            'revenue' => $this->revenue($from, $to, $previousFrom, $previousTo),
            'collection' => $this->collection($from, $to),
            'overdue' => $this->overdue($today),
            'revenue_by_month' => $this->revenueByMonth($today),
            'recent_sales' => $this->recentSales(),
        ];
    }

    /**
     * The period's first day, and the earlier stretch it is compared with. Calendar periods are
     * compared with the same days one month or year before, so the 29th is not set against a full month.
     *
     * @return array{CarbonImmutable, CarbonImmutable, CarbonImmutable}
     */
    private function rangesOf(string $period, CarbonImmutable $today): array {
        $today = $today->startOfDay();

        return match ($period) {
            self::PERIOD_LAST_30_DAYS => [
                $today->subDays(29),
                $today->subDays(59),
                $today->subDays(30)->endOfDay(),
            ],
            self::PERIOD_LAST_3_MONTHS => [
                $today->subMonthsNoOverflow(3)->addDay(),
                $today->subMonthsNoOverflow(6)->addDay(),
                $today->subMonthsNoOverflow(3)->endOfDay(),
            ],
            self::PERIOD_THIS_YEAR => [
                $today->startOfYear(),
                $today->subYearNoOverflow()->startOfYear(),
                $today->subYearNoOverflow()->endOfDay(),
            ],
            default => [
                $today->startOfMonth(),
                $today->subMonthNoOverflow()->startOfMonth(),
                $today->subMonthNoOverflow()->endOfDay(),
            ],
        };
    }

    /**
     * @return array{total: int, new: int}
     */
    private function customers(CarbonImmutable $from, CarbonImmutable $to): array {
        $row = DB::connection('tenant')->table('people')
            ->where('is_customer', 1)
            ->whereNull('deleted_at')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('COALESCE(SUM(created_at BETWEEN ? AND ?), 0) AS new_customers', [$from, $to])
            ->first();

        return ['total' => (int) $row?->total, 'new' => (int) $row?->new_customers];
    }

    /**
     * @return array{current: int, previous: int}
     */
    private function productsSold(
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $previousFrom,
        CarbonImmutable $previousTo,
    ): array {
        $row = $this->contracts()
            ->whereBetween('appliance_people.created_at', [$previousFrom, $to])
            ->selectRaw('COALESCE(SUM(appliance_people.created_at BETWEEN ? AND ?), 0) AS current_count', [$from, $to])
            ->selectRaw('COALESCE(SUM(appliance_people.created_at BETWEEN ? AND ?), 0) AS previous_count', [$previousFrom, $previousTo])
            ->first();

        return ['current' => (int) $row?->current_count, 'previous' => (int) $row?->previous_count];
    }

    /**
     * Confirmed payments, as the transaction list totals them.
     *
     * @return array{current: float, previous: float}
     */
    private function revenue(
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $previousFrom,
        CarbonImmutable $previousTo,
    ): array {
        $row = $this->confirmedTransactions()
            ->whereBetween('created_at', [$previousFrom, $to])
            ->selectRaw('COALESCE(SUM(CASE WHEN created_at BETWEEN ? AND ? THEN amount END), 0) AS current_amount', [$from, $to])
            ->selectRaw('COALESCE(SUM(CASE WHEN created_at BETWEEN ? AND ? THEN amount END), 0) AS previous_amount', [$previousFrom, $previousTo])
            ->toBase()
            ->first();

        return ['current' => (float) $row?->current_amount, 'previous' => (float) $row?->previous_amount];
    }

    /**
     * What was paid of the installments that fell due in the period. Every period ends today, so
     * none of them is still waiting for its due date.
     *
     * @return array{due: float, paid: float}
     */
    private function collection(CarbonImmutable $from, CarbonImmutable $to): array {
        $row = $this->contractRates()
            ->whereBetween('appliance_rates.due_date', [$from, $to])
            ->selectRaw('COALESCE(SUM(appliance_rates.rate_cost), 0) AS due')
            ->selectRaw('COALESCE(SUM(appliance_rates.rate_cost - appliance_rates.remaining), 0) AS paid')
            ->first();

        return ['due' => (float) $row?->due, 'paid' => (float) $row?->paid];
    }

    /**
     * Customers with an unpaid installment past its due date, aged by the oldest one, as the
     * customer list's overdue standing reads it.
     *
     * @return array{customers: int, amount: float, buckets: list<array{bucket: string, customers: int, amount: float}>}
     */
    private function overdue(CarbonImmutable $today): array {
        $perCustomer = $this->contractRates()
            ->join('people', 'people.id', '=', 'appliance_people.person_id')
            ->whereNull('people.deleted_at')
            ->where('appliance_rates.remaining', '>', 0)
            ->where('appliance_rates.due_date', '<', $today->startOfDay())
            ->groupBy('appliance_people.person_id')
            ->selectRaw('DATEDIFF(?, MIN(appliance_rates.due_date)) AS days_late', [$today->toDateString()])
            ->selectRaw('SUM(appliance_rates.remaining) AS amount');

        $bucketCase = 'CASE';
        $bindings = [];
        foreach (self::OVERDUE_BUCKETS as $bucket => $upTo) {
            if ($upTo === null) {
                $bucketCase .= ' ELSE ?';
            } else {
                $bucketCase .= ' WHEN days_late <= ? THEN ?';
                $bindings[] = $upTo;
            }
            $bindings[] = $bucket;
        }
        $bucketCase .= ' END';

        $rows = DB::connection('tenant')->query()
            ->fromSub($perCustomer, 'overdue_customers')
            ->selectRaw("{$bucketCase} AS bucket", $bindings)
            ->selectRaw('COUNT(*) AS customers, SUM(amount) AS amount')
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $buckets = [];
        foreach (array_keys(self::OVERDUE_BUCKETS) as $bucket) {
            $row = $rows->get($bucket);
            $buckets[] = [
                'bucket' => $bucket,
                'customers' => (int) ($row->customers ?? 0),
                'amount' => (float) ($row->amount ?? 0),
            ];
        }

        return [
            'customers' => array_sum(array_column($buckets, 'customers')),
            'amount' => array_sum(array_column($buckets, 'amount')),
            'buckets' => $buckets,
        ];
    }

    /**
     * Confirmed payments in each of the last twelve months, this one included, oldest first.
     *
     * @return list<array{month: string, revenue: float}>
     */
    private function revenueByMonth(CarbonImmutable $today): array {
        $firstMonth = $today->startOfMonth()->subMonths(self::MONTHS_OF_REVENUE - 1);
        $revenue = $this->confirmedTransactions()
            ->where('created_at', '>=', $firstMonth)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount) AS revenue")
            ->groupBy('month')
            ->toBase()
            ->pluck('revenue', 'month');

        $months = [];
        for ($offset = 0; $offset < self::MONTHS_OF_REVENUE; ++$offset) {
            $month = $firstMonth->addMonths($offset)->format('Y-m');
            $months[] = ['month' => $month, 'revenue' => (float) ($revenue[$month] ?? 0)];
        }

        return $months;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentSales(): array {
        return $this->contracts()
            ->join('people', 'people.id', '=', 'appliance_people.person_id')
            ->leftJoin('appliances', 'appliances.id', '=', 'appliance_people.appliance_id')
            ->leftJoin('agents', function ($join): void {
                $join->on('agents.id', '=', 'appliance_people.creator_id')
                    ->where('appliance_people.creator_type', Agent::RELATION_NAME);
            })
            ->leftJoin('people AS agent_people', 'agent_people.id', '=', 'agents.person_id')
            ->leftJoin('users', function ($join): void {
                $join->on('users.id', '=', 'appliance_people.creator_id')
                    ->where('appliance_people.creator_type', User::RELATION_NAME);
            })
            ->select([
                'appliance_people.id',
                'appliance_people.total_cost',
                'appliance_people.payment_type',
                'appliance_people.price_per_day',
                'appliance_people.created_at',
                'people.id AS customer_id',
                'people.name AS customer_name',
                'people.surname AS customer_surname',
                'appliances.name AS product',
            ])
            ->selectRaw("COALESCE(TRIM(CONCAT(agent_people.name, ' ', COALESCE(agent_people.surname, ''))), users.name) AS sold_by")
            ->latest('appliance_people.created_at')
            ->orderByDesc('appliance_people.id')
            ->limit(self::RECENT_SALES)
            ->get()
            ->map(static fn (object $row): array => [
                'id' => (int) $row->id,
                'customer' => [
                    'id' => (int) $row->customer_id,
                    'name' => (string) $row->customer_name,
                    'surname' => (string) $row->customer_surname,
                ],
                'product' => $row->product,
                'total_cost' => (float) $row->total_cost,
                'payment_type' => (string) $row->payment_type,
                'price_per_day' => $row->price_per_day === null ? null : (float) $row->price_per_day,
                'sold_by' => $row->sold_by,
                'created_at' => CarbonImmutable::parse($row->created_at)->toIso8601ZuluString(),
            ])
            ->values()
            ->all();
    }

    /**
     * The status lives on each provider's own transaction table, so it is checked through the morph.
     *
     * @return EloquentBuilder<Transaction>
     */
    private function confirmedTransactions(): EloquentBuilder {
        return $this->transaction->newQuery()->whereHasMorph(
            'originalTransaction',
            '*',
            static fn (EloquentBuilder $original) => $original->whereIn('status', self::CONFIRMED_STATUSES)
        );
    }

    private function contracts(): Builder {
        return DB::connection('tenant')->table('appliance_people')->whereNull('appliance_people.deleted_at');
    }

    private function contractRates(): Builder {
        return $this->contracts()->join('appliance_rates', 'appliance_rates.appliance_person_id', '=', 'appliance_people.id');
    }
}
