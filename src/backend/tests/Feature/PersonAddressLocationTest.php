<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Address\Address;
use App\Models\Person\Person;
use Database\Factories\Person\PersonFactory;
use Tests\CreateEnvironments;
use Tests\TestCase;

class PersonAddressLocationTest extends TestCase {
    use CreateEnvironments;

    public function testNewCustomerAddressIsPinnedOnTheMap(): void {
        $this->createTestData();
        $this->createCluster();
        $this->createMiniGrid();
        $this->createCity();

        $response = $this->actingAs($this->user)->postJson('/api/people', [
            'name' => 'Blessing',
            'surname' => 'Danjuma',
            'phone' => '+2348035550199',
            'city_id' => $this->city->id,
            'is_customer' => true,
            'points' => '9.57621,8.2985',
        ]);

        $response->assertStatus(201);
        $address = Person::query()->findOrFail($response->json('data.id'))->addresses()->with('geo')->firstOrFail();
        $this->assertSame([8.2985, 9.57621], $address->geo->geo_json->geometry->coordinates);
    }

    public function testNewCustomerWithoutLocationHasNoPin(): void {
        $this->createTestData();
        $this->createCluster();
        $this->createMiniGrid();
        $this->createCity();

        $response = $this->actingAs($this->user)->postJson('/api/people', [
            'name' => 'Blessing',
            'surname' => 'Danjuma',
            'city_id' => $this->city->id,
            'is_customer' => true,
        ]);

        $response->assertStatus(201);
        $this->assertNull(Person::query()->findOrFail($response->json('data.id'))->addresses()->firstOrFail()->geo);
    }

    public function testMalformedLocationIsRejected(): void {
        $this->createTestData();

        $response = $this->actingAs($this->user)->postJson('/api/people', [
            'name' => 'Blessing',
            'surname' => 'Danjuma',
            'points' => 'somewhere',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('points');
    }

    public function testUpdatingTheAddressMovesThePin(): void {
        $this->createTestData();
        $this->createCluster();
        $this->createMiniGrid();
        $this->createCity();
        $person = PersonFactory::new()->create(['is_customer' => 1]);
        $address = Address::query()->make(['phone' => '+2348035550199', 'is_primary' => 1, 'city_id' => $this->city->id]);
        $address->owner()->associate($person)->save();

        $first = $this->actingAs($this->user)->putJson("/api/people/{$person->id}/addresses", [
            'id' => $address->id,
            'city_id' => $this->city->id,
            'phone' => '+2348035550199',
            'is_primary' => 1,
            'points' => '9.5,8.2',
        ]);
        $second = $this->actingAs($this->user)->putJson("/api/people/{$person->id}/addresses", [
            'id' => $address->id,
            'city_id' => $this->city->id,
            'phone' => '+2348035550199',
            'is_primary' => 1,
            'points' => '9.6,8.3',
        ]);

        $first->assertStatus(200);
        $second->assertStatus(200);
        $this->assertSame(1, $address->geo()->count(), 'The pin moves instead of piling up');
        $this->assertSame([8.3, 9.6], $address->fresh()->geo->geo_json->geometry->coordinates);
        $this->assertSame([8.3, 9.6], $second->json('data.geo.geo_json.geometry.coordinates'));
        $this->assertSame(1, (int) $address->fresh()->is_primary, 'Editing the primary address keeps it primary');
    }

    public function testUpdatingPersonalDataIgnoresAddressFields(): void {
        $this->createTestData();
        $person = PersonFactory::new()->create(['is_customer' => 1, 'name' => 'Old']);

        $response = $this->actingAs($this->user)->putJson("/api/people/{$person->id}", [
            'name' => 'Blessing',
            'surname' => 'Danjuma',
            'street' => 'Market Road 12',
            'points' => '9.5,8.2',
        ]);

        $response->assertStatus(200);
        $this->assertSame('Blessing', $person->fresh()->name);
    }
}
