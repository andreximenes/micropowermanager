<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Transaction\Transaction;
use App\Services\TransactionService;
use Carbon\CarbonImmutable;
use Database\Factories\AgentTransactionFactory;
use Database\Factories\DeviceFactory;
use Database\Factories\Meter\MeterFactory;
use Database\Factories\Person\PersonFactory;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Tests\TestCase;

class TransactionListTest extends TestCase {
    protected function tearDown(): void {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function testSerialNumberAndTariffFiltersNarrowTogether(): void {
        $this->createMeterTransaction('SER-A-100', tariffId: 1);
        $this->createMeterTransaction('SER-A-200', tariffId: 2);
        $this->createMeterTransaction('SER-B-100', tariffId: 2);

        $response = $this->actingAs($this->userWith('transactions'))
            ->getJson('/api/transactions/advanced?serial_number=SER-A&tariff=2');

        $response->assertOk();
        $this->assertSame(['SER-A-200'], array_column($response->json('data'), 'message'));
    }

    public function testAPlainToDateIncludesTheWholeDay(): void {
        $this->createMeterTransaction('SER-LATE', createdAt: '2026-10-31 18:45:00');
        $this->createMeterTransaction('SER-NEXT-DAY', createdAt: '2026-11-01 00:00:01');

        $response = $this->actingAs($this->userWith('transactions'))
            ->getJson('/api/transactions/advanced?from=2026-10-31&to=2026-10-31');

        $this->assertSame(['SER-LATE'], array_column($response->json('data'), 'message'));
    }

    public function testEachRowNamesTheCustomerWhoOwnsTheDevice(): void {
        $person = PersonFactory::new()->create(['name' => 'Ada', 'surname' => 'Lovelace']);
        $this->createMeterTransaction('SER-OWNED', personId: $person->id);

        $response = $this->actingAs($this->userWith('transactions'))->getJson('/api/transactions');

        $response->assertOk();
        $response->assertJsonPath('data.0.device.person.id', $person->id);
        $response->assertJsonPath('data.0.device.person.name', 'Ada');
        $response->assertJsonPath('data.0.device.person.surname', 'Lovelace');
        $response->assertJsonMissingPath('data.0.device.person.is_active');
    }

    public function testTransactionProvidersRequireAnAuthenticatedUserWithTheTransactionsPermission(): void {
        $this->getJson('/api/transaction-providers')->assertUnauthorized();

        $this->actingAs($this->userWith())->getJson('/api/transaction-providers')->assertForbidden();

        $this->actingAs($this->userWith('transactions'))->getJson('/api/transaction-providers')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function testYesterdayIsComparedWithTheDayBefore(): void {
        CarbonImmutable::setTestNow('2026-10-29 10:00:00');

        $period = app(TransactionService::class)->determinePeriod(TransactionService::YESTERDAY);

        $this->assertSame([
            'currentPeriod' => ['begins' => '2026-10-28 00:00:00', 'ends' => '2026-10-28 23:59:59'],
            'lastPeriod' => ['begins' => '2026-10-27 00:00:00', 'ends' => '2026-10-27 23:59:59'],
        ], $period);
    }

    public function testSameDayLastWeekComparesYesterdayWithTheSameWeekdayAWeekEarlier(): void {
        CarbonImmutable::setTestNow('2026-10-29 10:00:00');

        $period = app(TransactionService::class)->determinePeriod(TransactionService::SAME_DAY_LAST_WEEK);

        $this->assertSame([
            'currentPeriod' => ['begins' => '2026-10-28 00:00:00', 'ends' => '2026-10-28 23:59:59'],
            'lastPeriod' => ['begins' => '2026-10-21 00:00:00', 'ends' => '2026-10-21 23:59:59'],
        ], $period);
    }

    public function testMultiDayPeriodsAreWholeDaysThatDoNotOverlap(): void {
        CarbonImmutable::setTestNow('2026-10-29 10:00:00');
        $service = app(TransactionService::class);

        $this->assertSame([
            'currentPeriod' => ['begins' => '2026-10-22 00:00:00', 'ends' => '2026-10-28 23:59:59'],
            'lastPeriod' => ['begins' => '2026-10-15 00:00:00', 'ends' => '2026-10-21 23:59:59'],
        ], $service->determinePeriod(TransactionService::LAST_SEVEN_DAYS));
        $this->assertSame([
            'currentPeriod' => ['begins' => '2026-09-29 00:00:00', 'ends' => '2026-10-28 23:59:59'],
            'lastPeriod' => ['begins' => '2026-08-30 00:00:00', 'ends' => '2026-09-28 23:59:59'],
        ], $service->determinePeriod(TransactionService::LAST_THIRTY_DAYS));
    }

    public function testAnalyticsCountConfirmedAndCancelledPaymentsByTheirStatus(): void {
        CarbonImmutable::setTestNow('2026-10-29 10:00:00');
        $this->createMeterTransaction('SER-1', createdAt: '2026-10-28 09:00:00', status: 1, amount: 500);
        $this->createMeterTransaction('SER-2', createdAt: '2026-10-28 10:00:00', status: 0, amount: 700);
        $this->createMeterTransaction('SER-3', createdAt: '2026-10-28 11:00:00', status: -1, amount: 900);
        $this->createMeterTransaction('SER-4', createdAt: '2026-10-27 11:00:00', status: 1, amount: 250);
        $this->createMeterTransaction('SER-TODAY', createdAt: '2026-10-29 08:00:00', status: 1, amount: 9999);

        $response = $this->actingAs($this->userWith('transactions'))
            ->getJson('/api/transactions/analytics/'.TransactionService::YESTERDAY);

        $response->assertOk();
        $response->assertJsonPath('current.total', 3);
        $response->assertJsonPath('current.confirmed', 1);
        $response->assertJsonPath('current.cancelled', 1);
        $this->assertEquals(500, $response->json('current.amount'));
        $response->assertJsonPath('past.total', 1);
        $this->assertEquals(100, $response->json('analytics.amountPercentage.percentage'));
    }

    private function userWith(string ...$permissions): \App\Models\User {
        $user = UserFactory::new()->create();
        $this->assignPermission($user, ...$permissions);

        return $user;
    }

    private function createMeterTransaction(
        string $serial,
        int $tariffId = 1,
        ?int $personId = null,
        string $createdAt = '2026-10-15 12:00:00',
        int $status = 1,
        int $amount = 1000,
    ): Transaction {
        $meter = MeterFactory::new()->create(['tariff_id' => $tariffId]);
        DeviceFactory::new()->create([
            'device_serial' => $serial,
            'device_id' => $meter->id,
            'device_type' => 'meter',
            'person_id' => $personId,
        ]);
        $agentTransaction = AgentTransactionFactory::new()->create(['status' => $status]);

        return TransactionFactory::new()->create([
            'message' => $serial,
            'amount' => $amount,
            'original_transaction_id' => $agentTransaction->id,
            'original_transaction_type' => 'agent_transaction',
            'created_at' => $createdAt,
        ]);
    }
}
