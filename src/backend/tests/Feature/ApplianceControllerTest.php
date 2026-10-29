<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Appliance;
use App\Models\ApplianceType;
use Database\Factories\AgentAssignedAppliancesFactory;
use Database\Factories\ApplianceFactory;
use Database\Factories\AppliancePersonFactory;
use Database\Factories\ApplianceTypeFactory;
use Database\Factories\ManufacturerFactory;
use Database\Factories\SolarHomeSystemFactory;
use Tests\CreateEnvironments;
use Tests\TestCase;

class ApplianceControllerTest extends TestCase {
    use CreateEnvironments;

    protected function setUp(): void {
        parent::setUp();

        $this->createTestData();
    }

    public function testItCreatesAnApplianceOfAnExistingType(): void {
        $type = ApplianceTypeFactory::new()->create();

        $this->actingAs($this->user)->postJson('/api/appliances', [
            'appliance_type_id' => $type->id,
            'name' => 'Spark Lite Kit',
            'price' => 1500,
        ])->assertStatus(200);

        $this->assertDatabaseHas('appliances', ['name' => 'Spark Lite Kit', 'appliance_type_id' => $type->id], 'tenant');
    }

    public function testItRejectsCreatingAnApplianceWithAnUnknownType(): void {
        $this->actingAs($this->user)->postJson('/api/appliances', [
            'appliance_type_id' => 999999,
            'name' => 'Spark Lite Kit',
            'price' => 1500,
        ])->assertStatus(422)->assertJsonValidationErrors(['appliance_type_id']);
    }

    public function testItUpdatesTheTypeOfAnAppliance(): void {
        $appliance = $this->createAppliance();
        $newType = ApplianceTypeFactory::new()->create();

        $this->actingAs($this->user)->putJson("/api/appliances/{$appliance->id}", [
            'appliance_type_id' => $newType->id,
            'name' => 'Kit',
            'price' => 2500,
        ])->assertStatus(200);

        $appliance->refresh();
        $this->assertSame($newType->id, $appliance->appliance_type_id);
        $this->assertSame('Kit', $appliance->name);
        $this->assertEquals(2500, $appliance->price);
    }

    public function testItRejectsUpdatingAnApplianceWithInvalidValues(): void {
        $appliance = $this->createAppliance();

        $this->actingAs($this->user)->putJson("/api/appliances/{$appliance->id}", [
            'appliance_type_id' => 999999,
            'name' => 'ab',
            'price' => 0,
        ])->assertStatus(422)->assertJsonValidationErrors(['appliance_type_id', 'name', 'price']);
    }

    public function testItListsAppliancesWithTheirSoldCount(): void {
        $sold = $this->createAppliance();
        $unsold = $this->createAppliance();
        AppliancePersonFactory::new()->count(2)->create(['appliance_id' => $sold->id]);
        AppliancePersonFactory::new()->create(['appliance_id' => $sold->id])->delete();

        $paginated = $this->actingAs($this->user)->getJson('/api/appliances?per_page=10')->assertStatus(200);
        $unpaginated = $this->actingAs($this->user)->getJson('/api/appliances')->assertStatus(200);

        foreach ([$paginated, $unpaginated] as $response) {
            $soldCounts = array_column($response->json('data'), 'sold_count', 'id');
            $this->assertSame(2, $soldCounts[$sold->id]);
            $this->assertSame(0, $soldCounts[$unsold->id]);
            $this->assertNotContains(null, array_column($response->json('data'), 'appliance_type'));
        }
    }

    public function testItDeletesAnUnusedAppliance(): void {
        $appliance = $this->createAppliance();

        $this->actingAs($this->user)->deleteJson("/api/appliances/{$appliance->id}")->assertStatus(200);

        $this->assertDatabaseMissing('appliances', ['id' => $appliance->id], 'tenant');
    }

    public function testItRefusesToDeleteASoldAppliance(): void {
        $appliance = $this->createAppliance(['name' => 'Spark Lite Kit']);
        AppliancePersonFactory::new()->create(['appliance_id' => $appliance->id])->delete();

        $this->actingAs($this->user)->deleteJson("/api/appliances/{$appliance->id}")
            ->assertStatus(422)
            ->assertExactJson(['message' => "Spark Lite Kit has been sold or has devices linked, so it can't be deleted. Change its price instead."]);

        $this->assertDatabaseHas('appliances', ['id' => $appliance->id], 'tenant');
    }

    public function testItRefusesToDeleteAnApplianceAssignedToAnAgent(): void {
        $appliance = $this->createAppliance();
        AgentAssignedAppliancesFactory::new()->create(['appliance_id' => $appliance->id]);

        $this->actingAs($this->user)->deleteJson("/api/appliances/{$appliance->id}")->assertStatus(422);

        $this->assertDatabaseHas('appliances', ['id' => $appliance->id], 'tenant');
    }

    public function testItRefusesToDeleteAnApplianceLinkedToASolarHomeSystem(): void {
        $appliance = $this->createAppliance();
        SolarHomeSystemFactory::new()->create([
            'manufacturer_id' => ManufacturerFactory::new()->isShsManufacturer()->create()->id,
            'appliance_id' => $appliance->id,
        ]);

        $this->actingAs($this->user)->deleteJson("/api/appliances/{$appliance->id}")->assertStatus(422);

        $this->assertDatabaseHas('appliances', ['id' => $appliance->id], 'tenant');
    }

    public function testItDeletesAnApplianceTypeWithoutProducts(): void {
        $type = ApplianceTypeFactory::new()->create();

        $this->actingAs($this->user)->deleteJson("/api/appliances/types/{$type->id}")->assertStatus(200);

        $this->assertDatabaseMissing('appliance_types', ['id' => $type->id], 'tenant');
    }

    public function testItRefusesToDeleteAnApplianceTypeWithProducts(): void {
        $type = ApplianceTypeFactory::new()->create(['name' => 'Lamps']);
        $this->createAppliance(['appliance_type_id' => $type->id]);

        $this->actingAs($this->user)->deleteJson("/api/appliances/types/{$type->id}")
            ->assertStatus(422)
            ->assertExactJson(['message' => "Lamps still has products, so it can't be deleted. Move or delete those products first."]);

        $this->assertDatabaseHas('appliance_types', ['id' => $type->id], 'tenant');
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function createAppliance(array $attributes = []): Appliance {
        return ApplianceFactory::new()->create(array_merge([
            'appliance_type_id' => ApplianceType::APPLIANCE_TYPE_SHS,
        ], $attributes));
    }
}
