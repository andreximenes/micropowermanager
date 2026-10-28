<template>
  <div class="md-layout md-gutter">
    <!-- Side by side only on wide monitors; on laptops the SKU table needs the full width. -->
    <div class="md-layout-item md-size-100 md-xlarge-size-40">
      <appliance-type-list />
    </div>
    <div class="md-layout-item md-size-100 md-xlarge-size-60">
      <add-appliance :addNewAppliance="addNewAppliance" />
      <widget
        :title="$tc('phrases.applianceSku', 2)"
        :subscriber="subscriber"
        :route_name="'/appliances'"
        :button="true"
        :button-text="$tc('phrases.newAppliance', 1)"
        @widgetAction="showAddAppliance"
        :reset-key="resetKey"
        :paginator="applianceService.paginator"
      >
        <md-table>
          <md-table-row>
            <md-table-head v-for="(item, index) in headers" :key="index">
              {{ item }}
            </md-table-head>
          </md-table-row>

          <md-table-row
            v-for="(appliance, index) in applianceService.list"
            :key="index"
          >
            <md-table-cell class="nowrap">
              {{ appliance.applianceTypeName }}
            </md-table-cell>

            <md-table-cell>
              <div class="md-layout" v-if="updatingAppliance === index">
                <md-field
                  :class="{
                    'md-invalid': errors.has('Appliance Name'),
                  }"
                >
                  <label for="applianceName"></label>
                  <md-input
                    name="applianceName"
                    type="text"
                    v-model="appliance.name"
                    v-validate="'required|min:5'"
                  ></md-input>
                  <span class="md-error">
                    {{ errors.first("Appliance Name") }}
                  </span>
                </md-field>
              </div>
              <span v-else>{{ appliance.name }}</span>
            </md-table-cell>
            <md-table-cell>
              <div class="md-layout" v-if="updatingAppliance === index">
                <md-field
                  :class="{
                    'md-invalid': errors.has('price'),
                  }"
                >
                  <label for="price"></label>
                  <md-input
                    name="price"
                    type="number"
                    v-model="appliance.price"
                    v-validate="'required'"
                  ></md-input>
                  <span class="md-error">
                    {{ errors.first("price") }}
                  </span>
                </md-field>
              </div>
              <span v-else>{{ appliance.price }}</span>
            </md-table-cell>
            <md-table-cell class="nowrap">
              {{ appliance.updatedAt }}
            </md-table-cell>
            <md-table-cell>
              <div
                class="md-layout md-gutter"
                style="cursor: pointer"
                v-if="updatingAppliance === index"
              >
                <md-button
                  class="md-primary md-dense"
                  @click="updateAppliance(appliance)"
                >
                  <md-icon class="md-primary">save</md-icon>
                  <span class="md-primary">
                    {{ $tc("words.save") }}
                  </span>
                </md-button>
                <md-button
                  class="md-accent md-dense"
                  @click="closeApplianceUpdate"
                >
                  <md-icon class="md-accent">close</md-icon>
                  <span class="md-accent">
                    {{ $tc("words.close") }}
                  </span>
                </md-button>
              </div>
              <div class="row-actions" v-else>
                <md-button
                  class="md-icon-button md-dense"
                  @click="openApplianceUpdate(index)"
                >
                  <md-tooltip>{{ $tc("words.edit") }}</md-tooltip>
                  <md-icon>edit</md-icon>
                </md-button>
                <md-button
                  class="md-icon-button md-dense md-accent"
                  :disabled="loading"
                  @click="deleteAppliance(appliance)"
                >
                  <md-tooltip>{{ $tc("words.delete") }}</md-tooltip>
                  <md-icon>delete</md-icon>
                </md-button>
              </div>
              <md-progress-bar md-mode="indeterminate" v-if="loading" />
            </md-table-cell>
          </md-table-row>
        </md-table>
      </widget>
    </div>
  </div>
</template>

<script>
import { notify } from "@/mixins/notify.js"
import AddAppliance from "@/modules/Appliances/AddAppliance.vue"
import ApplianceTypeList from "@/modules/Appliances/ApplianceTypeList.vue"
import { ApplianceService } from "@/services/ApplianceService.js"
import { EventBus } from "@/shared/eventbus.js"
import Widget from "@/shared/Widget.vue"

export default {
  name: "Appliances",
  mixins: [notify],
  components: { AddAppliance, ApplianceTypeList, Widget },
  data() {
    return {
      headers: [
        this.$tc("words.type"),
        this.$tc("words.name"),
        this.$tc("words.price"),
        this.$tc("phrases.lastUpdate"),
        "",
      ],
      applianceService: new ApplianceService(),
      addNewAppliance: false,
      subscriber: "applianceList",
      updatingAppliance: null,
      loading: false,
      resetKey: 0,
    }
  },
  mounted() {
    EventBus.$on("pageLoaded", this.reloadList)
    EventBus.$on("applianceAdded", (appliances) => {
      this.addNewAppliance = false
      this.reloadList(this.subscriber, appliances)
    })
    EventBus.$on("addApplianceClosed", () => {
      this.addNewAppliance = false
    })
  },
  beforeDestroy() {
    EventBus.$off("pageLoaded", this.reloadList)
  },
  methods: {
    reloadList(subscriber, data) {
      if (subscriber !== this.subscriber) {
        return
      }
      this.applianceService.updateList(data)
      EventBus.$emit(
        "widgetContentLoaded",
        this.subscriber,
        this.applianceService.list.length,
      )
    },
    showAddAppliance() {
      this.addNewAppliance = true
    },
    async updateAppliance(applianceType) {
      let validator = await this.$validator.validateAll()
      if (!validator) {
        return
      }
      this.loading = true
      this.$swal({
        type: "question",
        title: "Update Appliance",
        text: "Are you sure to update the appliance?",
        showCancelButton: true,
        cancelButtonText: this.$tc("words.cancel"),
        confirmButtonText: this.$tc("words.update"),
      }).then(async (response) => {
        if (response.value) {
          this.updateAppliance = false
          try {
            await this.applianceService.updateAppliance(applianceType)
            this.alertNotify("success", "Appliance updated Successfully.")
            this.resetKey++
            this.updatingAppliance = null
          } catch (e) {
            this.alertNotify("error", e.message)
          }
        }
      })
      this.loading = false
    },
    async deleteAppliance(appliance) {
      this.$swal({
        type: "question",
        title: this.$tc("phrases.deleteAppliance", 0),
        text: this.$tc("phrases.deleteAppliance", 2),
        showCancelButton: true,
        cancelButtonText: this.$tc("words.cancel"),
        confirmButtonText: this.$tc("words.delete"),
      }).then(async (response) => {
        if (response.value) {
          try {
            this.loading = true
            await this.applianceService.deleteAppliance(appliance)
            this.loading = false
            this.alertNotify("success", this.$tc("phrases.deleteAppliance", 1))
            this.resetKey++
          } catch (e) {
            this.loading = false
            this.alertNotify("error", e.message)
          }
        }
      })
    },
    openApplianceUpdate(index) {
      if (this.updatingAppliance === index) {
        this.updatingAppliance = null
      } else {
        this.updatingAppliance = index
      }
    },
    closeApplianceUpdate() {
      this.updatingAppliance = null
    },
    closeAddComponent(data) {
      this.addNewApplianceType = data
    },
  },
}
</script>

<style scoped lang="scss">
.nowrap {
  white-space: nowrap;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
  white-space: nowrap;
}
</style>
