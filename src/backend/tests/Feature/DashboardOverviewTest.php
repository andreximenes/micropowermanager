<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Appliance;
use App\Models\AppliancePerson;
use App\Models\ApplianceRate;
use App\Models\Person\Person;
use App\Models\User;
use Database\Factories\AgentTransactionFactory;
use Database\Factories\AppliancePersonFactory;
use Database\Factories\ApplianceTypeFactory;
use Database\Factories\Person\PersonFactory;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Tests\TestCase;

class DashboardOverviewTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();
        $this->travelTo('2026-10-29 10:00:00');
    }

    public function testTheOverviewNeedsTheTransactionsPermission(): void {
        $this->getJson('/api/dashboard/overview')->assertUnauthorized();
        $this->actingAs(UserFactory::new()->create())->getJson('/api/dashboard/overview')->assertForbidden();
        $this->actingAs($this->userWith('transactions'))->getJson('/api/dashboard/overview')->assertOk();
    }

    public function testAnUnknownPeriodIsRejected(): void {
        $this->actingAs($this->userWith('transactions'))
            ->getJson('/api/dashboard/overview?period=fortnight')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('period');
    }

    public function testThisMonthIsComparedWithTheSameDaysOfLastMonth(): void {
        $amina = $this->customer('Amina', '2026-10-05 09:00:00');
        $bola = $this->customer('Bola', '2026-08-01 09:00:00');
        PersonFactory::new()->create(['is_customer' => 0, 'created_at' => '2026-10-06 09:00:00']);
        $this->customer('Deleted', '2026-10-07 09:00:00')->delete();

        $user = $this->userWith('transactions');
        $october = $this->contract($amina, '2026-10-10 12:00:00', 300, [
            [100, 0, '2026-10-02'],
            [100, 40, '2026-10-20'],
            [100, 100, '2026-11-20'],
        ], $user);
        $this->contract($bola, '2026-09-15 12:00:00', 150, [[100, 100, '2026-07-01'], [50, 50, '2026-09-01']]);
        $this->contract($bola, '2026-09-30 12:00:00', 10, []);
        $this->contract($amina, '2026-10-12 12:00:00', 500, [[500, 500, '2026-10-15']])->delete();

        $this->payment(1000, '2026-10-03 08:00:00');
        $this->payment(999, '2026-10-05 08:00:00', status: -1);
        $this->payment(400, '2026-09-10 08:00:00');
        $this->payment(50, '2026-09-30 08:00:00');

        $response = $this->actingAs($user)->getJson('/api/dashboard/overview?period=this_month');

        $response->assertOk();
        $response->assertJsonPath('data.period', [
            'from' => '2026-10-01',
            'to' => '2026-10-29',
            'previous_from' => '2026-09-01',
            'previous_to' => '2026-09-29',
        ]);
        $response->assertJsonPath('data.customers', ['total' => 2, 'new' => 1]);
        $response->assertJsonPath('data.products_sold', ['current' => 1, 'previous' => 1]);
        $this->assertEquals(['current' => 1000, 'previous' => 400], $response->json('data.revenue'));
        $this->assertEquals(['due' => 200, 'paid' => 160], $response->json('data.collection'));

        $this->assertEquals(2, $response->json('data.overdue.customers'));
        $this->assertEquals(190, $response->json('data.overdue.amount'));
        $this->assertEquals([
            ['bucket' => '1-30', 'customers' => 1, 'amount' => 40],
            ['bucket' => '31-60', 'customers' => 0, 'amount' => 0],
            ['bucket' => '61-90', 'customers' => 0, 'amount' => 0],
            ['bucket' => '90+', 'customers' => 1, 'amount' => 150],
        ], $response->json('data.overdue.buckets'));

        /** @var list<array{month: string, revenue: float}> $months */
        $months = $response->json('data.revenue_by_month');
        $this->assertCount(12, $months);
        $this->assertSame('2025-11', $months[0]['month']);
        $this->assertEquals(['month' => '2026-09', 'revenue' => 450], $months[10]);
        $this->assertEquals(['month' => '2026-10', 'revenue' => 1000], $months[11]);

        $sales = $response->json('data.recent_sales');
        $this->assertCount(3, $sales, 'Deleted contracts are not sales');
        $this->assertSame($october->id, $sales[0]['id']);
        $this->assertSame(['id' => $amina->id, 'name' => 'Amina', 'surname' => 'Okafor'], $sales[0]['customer']);
        $this->assertSame('Spark Steady Kit', $sales[0]['product']);
        $this->assertEquals(300, $sales[0]['total_cost']);
        $this->assertSame($user->name, $sales[0]['sold_by']);
        $this->assertSame('2026-10-10T12:00:00Z', $sales[0]['created_at']);
    }

    public function testEachPeriodHasItsOwnComparisonWindow(): void {
        $user = $this->userWith('transactions');
        $periods = [
            'last_30_days' => ['2026-09-30', '2026-10-29', '2026-08-31', '2026-09-29'],
            'last_3_months' => ['2026-07-30', '2026-10-29', '2026-04-30', '2026-07-29'],
            'this_year' => ['2026-01-01', '2026-10-29', '2025-01-01', '2025-10-29'],
        ];

        foreach ($periods as $period => [$from, $to, $previousFrom, $previousTo]) {
            $this->actingAs($user)->getJson("/api/dashboard/overview?period={$period}")
                ->assertJsonPath('data.period', [
                    'from' => $from,
                    'to' => $to,
                    'previous_from' => $previousFrom,
                    'previous_to' => $previousTo,
                ]);
        }
    }

    private function userWith(string ...$permissions): User {
        $user = UserFactory::new()->create();
        $this->assignPermission($user, ...$permissions);

        return $user;
    }

    private function customer(string $name, string $createdAt): Person {
        return PersonFactory::new()->create([
            'is_customer' => 1,
            'name' => $name,
            'surname' => 'Okafor',
            'created_at' => $createdAt,
        ]);
    }

    /**
     * @param array<int, array{0: int, 1: int, 2: string}> $rates [cost, remaining, due date]
     */
    private function contract(Person $person, string $createdAt, int $totalCost, array $rates, ?User $seller = null): AppliancePerson {
        $appliance = Appliance::query()->create([
            'name' => 'Spark Steady Kit',
            'price' => $totalCost,
            'appliance_type_id' => ApplianceTypeFactory::new()->create()->id,
        ]);

        /** @var AppliancePerson $contract */
        $contract = AppliancePersonFactory::new()->create([
            'appliance_id' => $appliance->id,
            'person_id' => $person->id,
            'total_cost' => $totalCost,
            'rate_count' => count($rates),
            'down_payment' => 0,
            'creator_type' => User::RELATION_NAME,
            'creator_id' => $seller->id ?? 0,
            'created_at' => $createdAt,
        ]);

        foreach ($rates as [$cost, $remaining, $due]) {
            ApplianceRate::query()->create([
                'appliance_person_id' => $contract->id,
                'rate_cost' => $cost,
                'remaining' => $remaining,
                'remind' => 0,
                'due_date' => $due,
            ]);
        }

        return $contract;
    }

    private function payment(int $amount, string $createdAt, int $status = 1): void {
        $agentTransaction = AgentTransactionFactory::new()->create(['status' => $status]);
        TransactionFactory::new()->create([
            'amount' => $amount,
            'original_transaction_id' => $agentTransaction->id,
            'original_transaction_type' => 'agent_transaction',
            'created_at' => $createdAt,
        ]);
    }
}
