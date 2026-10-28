<template>
  <md-card>
    <md-card-header>
      <div class="header">
        <div>
          <div class="md-title">Kit synchronization</div>
          <div class="md-subhead">
            Optional. Brings the kits of your Spark partner into
            MicroPowerManager as unassigned Solar Home Systems. Without it, the
            plugin works as usual: register Solar Home Systems by hand and Spark
            issues their tokens.
          </div>
        </div>
        <md-switch
          v-model="syncService.settings.isEnabled"
          class="md-primary"
          @change="toggleEnabled"
        >
          {{ syncService.settings.isEnabled ? "Enabled" : "Disabled" }}
        </md-switch>
      </div>
    </md-card-header>

    <md-card-content v-if="syncService.settings.isEnabled">
      <form
        data-vv-scope="Sync-Form"
        class="md-layout md-gutter interval-form"
        @submit.prevent="saveInterval"
      >
        <div class="md-layout-item md-size-30 md-small-size-100">
          <md-field
            :class="{ 'md-invalid': errors.has('Sync-Form.intervalHours') }"
          >
            <label for="intervalHours">Sync every (hours)</label>
            <md-input
              id="intervalHours"
              name="intervalHours"
              type="number"
              min="1"
              v-model="syncService.settings.intervalHours"
              v-validate="'required|min_value:1|max_value:720'"
            />
            <span class="md-error">
              {{ errors.first("Sync-Form.intervalHours") }}
            </span>
          </md-field>
        </div>
        <div class="md-layout-item md-size-30 md-small-size-100 inline-item">
          <md-button type="submit" class="md-raised">Save interval</md-button>
        </div>
      </form>

      <div class="last-sync">
        <strong>Last sync:</strong>
        <span v-if="!syncService.settings.lastSyncAt">never</span>
        <span v-else>
          {{ syncService.settings.lastSyncAt }} —
          {{ syncService.settings.lastSyncStatus }}
        </span>
        <md-button class="md-icon-button md-dense" @click="refresh">
          <md-icon>refresh</md-icon>
        </md-button>
        <div v-if="lastResult">
          <div v-if="lastResult.error" class="sync-error">
            {{ lastResult.error }}
          </div>
          <template v-else>
            <div>
              {{ lastResult.created }} created, {{ lastResult.existing }}
              already in MicroPowerManager
            </div>
            <div v-if="unmatchedKitTypes.length">
              Skipped, no rule or no appliance for kit type:
              <span v-for="item in unmatchedKitTypes" :key="item.kitType">
                <code>{{ item.kitType }}</code>
                ({{ item.count }})
              </span>
            </div>
            <div v-if="lastResult.conflicts.length">
              Skipped, serial already used by another device:
              <code>{{ lastResult.conflicts.join(", ") }}</code>
            </div>
          </template>
        </div>
      </div>

      <h4>Kit type rules</h4>
      <div class="hint">
        <p>
          Each kit's type is matched against these patterns, ignoring case. A
          pattern matches anywhere in the type, so
          <code>spark_steady</code>
          also catches
          <code>spark_steady_fan</code>
          and
          <code>spark_steady_tv</code>
          . Kits are only created for rules that have an appliance.
        </p>
        <p>
          To sell a variation as its own appliance, add a more specific rule
          (for example
          <code>spark_steady_fan</code>
          ). Longer patterns are checked first, so the variation wins over the
          generic rule and everything else still falls into it. Patterns are
          regular expressions:
          <code>^spark_steady$</code>
          matches only the exact type.
        </p>
      </div>

      <md-table>
        <md-table-row>
          <md-table-head>Kit type pattern</md-table-head>
          <md-table-head>Appliance</md-table-head>
          <md-table-head></md-table-head>
        </md-table-row>
        <md-table-row v-for="mapping in syncService.mappings" :key="mapping.id">
          <md-table-cell>
            <code>{{ mapping.pattern }}</code>
          </md-table-cell>
          <md-table-cell>
            <md-field :class="{ 'missing-appliance': !mapping.applianceId }">
              <md-select
                :name="'appliance_' + mapping.id"
                v-model="mapping.applianceId"
                placeholder="Choose an appliance"
                @md-selected="updateMappingAppliance(mapping)"
              >
                <md-option
                  v-for="appliance in applianceService.list"
                  :key="appliance.id"
                  :value="appliance.id"
                >
                  {{ appliance.name }}
                </md-option>
              </md-select>
            </md-field>
          </md-table-cell>
          <md-table-cell>
            <md-button
              class="md-icon-button md-dense"
              @click="deleteMapping(mapping.id)"
            >
              <md-icon>delete</md-icon>
            </md-button>
          </md-table-cell>
        </md-table-row>
      </md-table>

      <form
        data-vv-scope="Mapping-Form"
        class="md-layout md-gutter"
        @submit.prevent="addMapping"
      >
        <div class="md-layout-item md-size-40 md-small-size-100">
          <md-field
            :class="{ 'md-invalid': errors.has('Mapping-Form.pattern') }"
          >
            <label for="pattern">New kit type pattern</label>
            <md-input
              id="pattern"
              name="pattern"
              v-model="newMapping.pattern"
              v-validate="'required'"
              placeholder="spark_steady_fan"
            />
            <span class="md-error">
              {{ errors.first("Mapping-Form.pattern") }}
            </span>
          </md-field>
        </div>
        <div class="md-layout-item md-size-40 md-small-size-100">
          <md-field>
            <label for="appliance">Appliance</label>
            <md-select
              id="appliance"
              name="appliance"
              v-model="newMapping.applianceId"
            >
              <md-option
                v-for="appliance in applianceService.list"
                :key="appliance.id"
                :value="appliance.id"
              >
                {{ appliance.name }}
              </md-option>
            </md-select>
          </md-field>
        </div>
        <div class="md-layout-item md-size-20 md-small-size-100 inline-item">
          <md-button type="submit" class="md-raised">Add rule</md-button>
        </div>
      </form>
    </md-card-content>

    <md-card-actions v-if="syncService.settings.isEnabled">
      <md-button class="md-raised md-accent" @click="syncNow">
        Sync now
      </md-button>
    </md-card-actions>
    <md-progress-bar md-mode="indeterminate" v-if="loading" />
  </md-card>
</template>

<script>
import { SyncService } from "../../services/SyncService.js"

import { notify } from "@/mixins/notify.js"
import { ApplianceService } from "@/services/ApplianceService.js"

const SYNC_POLL_INTERVAL_MS = 2000
const SYNC_POLL_ATTEMPTS = 45

export default {
  name: "KitSync",
  mixins: [notify],
  data() {
    return {
      syncService: new SyncService(),
      applianceService: new ApplianceService(),
      newMapping: { pattern: "", applianceId: null },
      loading: false,
    }
  },
  mounted() {
    this.run(async () => {
      await Promise.all([
        this.syncService.getSettings(),
        this.syncService.getMappings(),
        this.applianceService.getAppliances(),
      ])
    })
  },
  computed: {
    lastResult() {
      return this.syncService.settings.lastSyncResult
    },
    unmatchedKitTypes() {
      return Object.entries(this.lastResult?.unmatched_kit_types ?? {}).map(
        ([kitType, count]) => ({ kitType, count }),
      )
    },
  },
  methods: {
    async run(action, successMessage = null) {
      this.loading = true
      try {
        await action()
        if (successMessage) {
          this.alertNotify("success", successMessage)
        }
      } catch (e) {
        this.alertNotify("error", e.message)
      } finally {
        this.loading = false
      }
    },
    async toggleEnabled(isEnabled) {
      await this.run(
        () => this.syncService.updateSettings(),
        isEnabled
          ? "Kit synchronization enabled"
          : "Kit synchronization disabled",
      )
    },
    async saveInterval() {
      if (!(await this.$validator.validateAll("Sync-Form"))) {
        return
      }
      await this.run(() => this.syncService.updateSettings(), "Interval saved")
    },
    async syncNow() {
      const previousSyncAt = this.syncService.settings.lastSyncAt
      await this.run(async () => {
        await this.syncService.syncNow()
        // The sync runs on the queue; poll until the job records its outcome.
        for (let attempt = 0; attempt < SYNC_POLL_ATTEMPTS; attempt++) {
          await new Promise((resolve) =>
            setTimeout(resolve, SYNC_POLL_INTERVAL_MS),
          )
          const settings = await this.syncService.getSettings()
          if (settings.lastSyncAt !== previousSyncAt) {
            return this.notifySyncOutcome(settings)
          }
        }
        this.alertNotify(
          "warning",
          "Sync is still running. Use refresh to see the result later.",
        )
      })
    },
    notifySyncOutcome(settings) {
      const result = settings.lastSyncResult ?? {}
      if (settings.lastSyncStatus !== "success") {
        this.alertNotify("error", `Sync failed: ${result.error}`)
        return
      }
      const skipped =
        Object.values(result.unmatched_kit_types ?? {}).reduce(
          (total, count) => total + count,
          0,
        ) + (result.conflicts?.length ?? 0)
      this.alertNotify(
        "success",
        `Sync finished: ${result.created} created, ${result.existing} already present, ${skipped} skipped.`,
      )
    },
    async refresh() {
      await this.run(() => this.syncService.getSettings())
    },
    async updateMappingAppliance(mapping) {
      // md-select also emits when the table first renders; only a real change is saved.
      if (mapping.applianceId === mapping.savedApplianceId) {
        return
      }
      await this.run(
        () => this.syncService.updateMappingAppliance(mapping),
        "Rule updated",
      )
    },
    async addMapping() {
      if (!(await this.$validator.validateAll("Mapping-Form"))) {
        return
      }
      await this.run(async () => {
        await this.syncService.createMapping(
          this.newMapping.pattern,
          this.newMapping.applianceId,
        )
        this.newMapping = { pattern: "", applianceId: null }
        this.$validator.reset("Mapping-Form")
      }, "Rule added")
    },
    async deleteMapping(id) {
      await this.run(() => this.syncService.deleteMapping(id), "Rule removed")
    },
  },
}
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.inline-item {
  display: flex;
  align-items: center;
}

.last-sync {
  margin: 1rem 0 2rem;
  line-height: 1.6;
}

.sync-error {
  color: #d32f2f;
}

.hint {
  font-size: 0.9rem;
  color: #666;
}

.missing-appliance {
  border-bottom: 2px solid #ff9800;
}
</style>
