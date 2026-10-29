<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Address\Address;
use App\Models\Appliance;
use App\Models\AppliancePerson;
use App\Models\ApplianceRate;
use App\Models\Person\Person;
use Database\Factories\AgentSoldApplianceFactory;
use Database\Factories\AppliancePersonFactory;
use Database\Factories\ApplianceTypeFactory;
use Database\Factories\Person\PersonFactory;
use Tests\CreateEnvironments;
use Tests\TestCase;

class PersonListStandingTest extends TestCase {
    use CreateEnvironments;

    public function testSearchTermCombinesWithFilters(): void {
        $this->createTestData();
        $overdueAmina = $this->customer('Amina', '+234800000001');
        $this->contract($overdueAmina, [[100, 100, '-10 days']]);
        $payingAmina = $this->customer('Amina', '+234800000002');
        $this->contract($payingAmina, [[100, 100, '+10 days']]);
        $this->customer('Bola', '+234800000003');

        $response = $this->actingAs($this->user)->getJson('/api/people?term=Ami&overdue=1');

        $response->assertStatus(200);
        $this->assertSame([$overdueAmina->id], collect($response->json('data'))->pluck('id')->all());
    }

    public function testSearchTermMatchesPhoneWithoutTheLeadingPlus(): void {
        $this->createTestData();
        $customer = $this->customer('Chinedu', '+234806221773');
        $this->customer('Halima', '+234805309447');

        $response = $this->actingAs($this->user)->getJson('/api/people?term=234806');

        $this->assertSame([$customer->id], collect($response->json('data'))->pluck('id')->all());
    }

    public function testWildcardsInTheTermAreMatchedLiterally(): void {
        $this->createTestData();
        $this->customer('Amina', '+234800000051');

        $response = $this->actingAs($this->user)->getJson('/api/people?term=%25');

        $response->assertStatus(200);
        $this->assertSame([], $response->json('data'));
    }

    public function testEachRowCarriesItsPaymentStanding(): void {
        $this->createTestData();
        $overdue = $this->customer('Overdue', '+234800000011');
        $this->contract($overdue, [[100, 0, '-40 days'], [100, 60, '-12 days'], [100, 100, '+18 days']]);
        $paidOff = $this->customer('Paid', '+234800000012');
        $this->contract($paidOff, [[100, 0, '-12 days']]);
        $withoutContract = $this->customer('None', '+234800000013');
        $deleted = $this->customer('Deleted', '+234800000014');
        $this->contract($deleted, [[100, 100, '-12 days']])->delete();

        $rows = collect($this->actingAs($this->user)->getJson('/api/people?per_page=50')->json('data'))->keyBy('id');

        $this->assertSame(1, (int) $rows[$overdue->id]['contracts_count']);
        $this->assertSame(160, (int) $rows[$overdue->id]['outstanding_amount']);
        $this->assertSame(now()->subDays(12)->toDateString(), substr((string) $rows[$overdue->id]['overdue_since'], 0, 10));

        $this->assertSame(1, (int) $rows[$paidOff->id]['contracts_count']);
        $this->assertSame(0, (int) $rows[$paidOff->id]['outstanding_amount']);
        $this->assertNull($rows[$paidOff->id]['overdue_since']);

        $this->assertSame(0, (int) $rows[$withoutContract->id]['contracts_count']);
        $this->assertSame(0, (int) $rows[$deleted->id]['contracts_count'], 'Deleted contracts do not count');
        $this->assertNull($rows[$deleted->id]['overdue_since']);
    }

    public function testOverdueFilterSplitsCustomers(): void {
        $this->createTestData();
        $overdue = $this->customer('Overdue', '+234800000021');
        $this->contract($overdue, [[100, 100, '-1 day']]);
        $upToDate = $this->customer('UpToDate', '+234800000022');
        $this->contract($upToDate, [[100, 100, '+1 day']]);

        $overdueIds = collect($this->actingAs($this->user)->getJson('/api/people?overdue=1')->json('data'))->pluck('id');
        $notOverdueIds = collect($this->actingAs($this->user)->getJson('/api/people?overdue=0')->json('data'))->pluck('id');

        $this->assertSame([$overdue->id], $overdueIds->all());
        $this->assertContains($upToDate->id, $notOverdueIds->all());
        $this->assertNotContains($overdue->id, $notOverdueIds->all());
    }

    public function testPrimaryAddressComesFirst(): void {
        $this->createTestData();
        $customer = $this->customer('Fatima', '+234800000031');
        $customer->addresses()->update(['is_primary' => 0]);
        $primary = Address::query()->make(['phone' => '+234800000099', 'is_primary' => 1]);
        $primary->owner()->associate($customer)->save();

        $row = collect($this->actingAs($this->user)->getJson('/api/people')->json('data'))->firstWhere('id', $customer->id);

        $this->assertSame('+234800000099', $row['addresses'][0]['phone']);
    }

    public function testEachRowNamesTheAgentWhoSoldToTheCustomer(): void {
        $this->createTestData();
        $this->createCluster();
        $this->createMiniGrid();
        $this->createCity();
        $this->createAgentCommission();
        $this->createAgent();
        $this->createAssignedAppliances();
        $customer = $this->customer('Musa', '+234800000041');
        AgentSoldApplianceFactory::new()->create([
            'agent_assigned_appliance_id' => $this->assignedAppliance->id,
            'person_id' => $customer->id,
        ]);

        $row = collect($this->actingAs($this->user)->getJson('/api/people')->json('data'))->firstWhere('id', $customer->id);

        $this->assertSame(
            $this->agent->person->name,
            $row['agent_sold_appliance']['assigned_appliance']['agent']['person']['name']
        );
    }

    private function customer(string $name, string $phone): Person {
        $person = PersonFactory::new()->create(['is_customer' => 1, 'name' => $name]);
        $address = Address::query()->make(['phone' => $phone, 'is_primary' => 1]);
        $address->owner()->associate($person)->save();

        return $person;
    }

    /**
     * @param array<int, array{0: int, 1: int, 2: string}> $rates [cost, remaining, due date relative to today]
     */
    private function contract(Person $person, array $rates): AppliancePerson {
        $appliance = Appliance::query()->create([
            'name' => 'Spark Steady Kit',
            'price' => 300,
            'appliance_type_id' => ApplianceTypeFactory::new()->create()->id,
        ]);

        /** @var AppliancePerson $contract */
        $contract = AppliancePersonFactory::new()->create([
            'appliance_id' => $appliance->id,
            'person_id' => $person->id,
            'total_cost' => array_sum(array_column($rates, 0)),
            'rate_count' => count($rates),
            'down_payment' => 0,
        ]);

        foreach ($rates as [$cost, $remaining, $due]) {
            ApplianceRate::query()->create([
                'appliance_person_id' => $contract->id,
                'rate_cost' => $cost,
                'remaining' => $remaining,
                'remind' => 0,
                'due_date' => now()->modify($due),
            ]);
        }

        return $contract;
    }
}
