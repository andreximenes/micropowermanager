<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Appliance;
use App\Models\ApplianceType;
use App\Models\Device;
use App\Models\Manufacturer;
use App\Models\Person\Person;
use App\Models\SolarHomeSystem;
use Database\Factories\Address\AddressFactory;
use Database\Factories\ApplianceFactory;
use Database\Factories\ApplianceTypeFactory;
use Database\Factories\CityFactory;
use Database\Factories\ManufacturerFactory;
use Database\Factories\PaymentHistoryFactory;
use Database\Factories\Person\PersonFactory;
use Database\Factories\SolarHomeSystemFactory;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Tests\CreateEnvironments;
use Tests\TestCase;

class SolarHomeSystemListTest extends TestCase {
    use CreateEnvironments;

    private Manufacturer $shsManufacturer;
    private Appliance $shsAppliance;

    protected function setUp(): void {
        parent::setUp();

        $this->createTestData();
        $this->shsManufacturer = ManufacturerFactory::new()->isShsManufacturer()->create();
        $this->shsAppliance = ApplianceFactory::new()->create(['appliance_type_id' => ApplianceType::APPLIANCE_TYPE_SHS]);
    }

    public function testItFiltersByTermAndSortsTogether(): void {
        $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');
        $this->createSolarHomeSystem('SHS-B-0002', 'Zawadi', 'Okafor');
        $this->createSolarHomeSystem('SHS-C-0003', 'Juma', 'Mwangi');

        $response = $this->actingAs($this->user)
            ->getJson('/api/solar-home-systems?term=okafor&sort_by=-serial_number&page=1&per_page=10')
            ->assertStatus(200);

        $this->assertSame(['SHS-B-0002', 'SHS-A-0001'], array_column($response->json('data'), 'serial_number'));
        $this->assertSame(2, $response->json('total'));
        $this->assertSame(10, $response->json('per_page'));
    }

    public function testItMatchesTheSerialNumberOrTheOwnersFullName(): void {
        $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');
        $this->createSolarHomeSystem('SHS-B-0002', 'Zawadi', 'Mwangi');

        $bySerial = $this->actingAs($this->user)->getJson('/api/solar-home-systems?term=B-0002');
        $byFullName = $this->actingAs($this->user)->getJson('/api/solar-home-systems?term=Amina%20Okafor');

        $this->assertSame(['SHS-B-0002'], array_column($bySerial->json('data'), 'serial_number'));
        $this->assertSame(['SHS-A-0001'], array_column($byFullName->json('data'), 'serial_number'));
    }

    public function testItSortsByOwner(): void {
        $this->createSolarHomeSystem('SHS-A-0001', 'Zawadi', 'Mwangi');
        $this->createSolarHomeSystem('SHS-B-0002', 'Amina', 'Okafor');

        $response = $this->actingAs($this->user)
            ->getJson('/api/solar-home-systems?sort_by=owner&per_page=10')
            ->assertStatus(200);

        $this->assertSame(['SHS-B-0002', 'SHS-A-0001'], array_column($response->json('data'), 'serial_number'));
    }

    public function testItPaginatesWithFifteenPerPageByDefault(): void {
        $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');

        $response = $this->actingAs($this->user)->getJson('/api/solar-home-systems')->assertStatus(200);

        $this->assertSame(15, $response->json('per_page'));
        $this->assertSame(1, $response->json('total'));
    }

    public function testTheLegacySearchRouteUsesTheSameFlow(): void {
        $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');
        $this->createSolarHomeSystem('SHS-B-0002', 'Zawadi', 'Mwangi');

        $response = $this->actingAs($this->user)
            ->getJson('/api/solar-home-systems/search?term=zawadi&per_page=5')
            ->assertStatus(200);

        $this->assertSame(['SHS-B-0002'], array_column($response->json('data'), 'serial_number'));
        $this->assertSame(5, $response->json('per_page'));
    }

    public function testItShowsTheOwnersAddressesWithTheirCity(): void {
        $solarHomeSystem = $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');
        $city = CityFactory::new()->create(['name' => 'Arusha', 'mini_grid_id' => 1]);
        AddressFactory::new()->create([
            'owner_type' => 'person',
            'owner_id' => $solarHomeSystem->device->person_id,
            'city_id' => $city->id,
        ]);

        $this->actingAs($this->user)->getJson("/api/solar-home-systems/{$solarHomeSystem->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.device.person.name', 'Amina')
            ->assertJsonPath('data.device.person.addresses.0.city.name', 'Arusha');
    }

    public function testItPaginatesTransactionsByPerPage(): void {
        $solarHomeSystem = $this->createSolarHomeSystem('SHS-A-0001', 'Amina', 'Okafor');
        foreach (range(1, 3) as $index) {
            $transaction = TransactionFactory::new()->create([
                'original_transaction_type' => 'cash_transaction',
                'original_transaction_id' => $index,
                'message' => $solarHomeSystem->serial_number,
            ]);
            PaymentHistoryFactory::new()->create([
                'id' => $index,
                'transaction_id' => $transaction->id,
                'paid_for_type' => 'token',
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson("/api/solar-home-systems/{$solarHomeSystem->id}/transactions?per_page=2")
            ->assertStatus(200);

        $this->assertSame(2, $response->json('per_page'));
        $this->assertSame(3, $response->json('total'));
        $this->assertCount(2, $response->json('data'));
    }

    public function testItStoresSolarHomeSystemsForAnOwner(): void {
        $person = PersonFactory::new()->create();

        $this->actingAs($this->user)->postJson('/api/solar-home-systems', [
            'serial_numbers' => ['SHS-NEW-0001'],
            'manufacturer_id' => $this->shsManufacturer->id,
            'appliance_id' => $this->shsAppliance->id,
            'person_id' => $person->id,
        ])->assertStatus(200);

        $this->assertDatabaseHas('devices', ['device_serial' => 'SHS-NEW-0001', 'person_id' => $person->id], 'tenant');
    }

    public function testItRefusesToStoreWithANonSolarHomeSystemApplianceOrUnknownOwner(): void {
        $lamp = ApplianceFactory::new()->create(['appliance_type_id' => ApplianceTypeFactory::new()->create()->id]);
        $meterManufacturer = ManufacturerFactory::new()->create(['type' => 'meter']);

        $this->actingAs($this->user)->postJson('/api/solar-home-systems', [
            'serial_numbers' => ['SHS-NEW-0001'],
            'manufacturer_id' => $meterManufacturer->id,
            'appliance_id' => $lamp->id,
            'person_id' => 999999,
        ])->assertStatus(422)->assertJsonValidationErrors(['manufacturer_id', 'appliance_id', 'person_id']);

        $this->assertDatabaseMissing('devices', ['device_serial' => 'SHS-NEW-0001'], 'tenant');
    }

    public function testUsersWithoutTheAppliancesPermissionAreRefused(): void {
        $user = UserFactory::new()->create();
        $this->assignPermission($user, 'customers');

        $this->actingAs($user)->getJson('/api/solar-home-systems')->assertStatus(403);
        $this->actingAs($user)->getJson('/api/solar-home-systems/search?term=a')->assertStatus(403);
    }

    private function createSolarHomeSystem(string $serialNumber, string $name, string $surname): SolarHomeSystem {
        $solarHomeSystem = SolarHomeSystemFactory::new()->create([
            'serial_number' => $serialNumber,
            'manufacturer_id' => $this->shsManufacturer->id,
            'appliance_id' => $this->shsAppliance->id,
        ]);
        /** @var Person $owner */
        $owner = PersonFactory::new()->create(['name' => $name, 'surname' => $surname]);
        Device::factory()
            ->for($solarHomeSystem, 'device')
            ->createOne(['device_serial' => $serialNumber, 'person_id' => $owner->id]);

        return $solarHomeSystem;
    }
}
