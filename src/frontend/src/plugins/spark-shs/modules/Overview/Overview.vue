<template>
  <div>
    <widget title="SparkShs Overview">
      <div class="md-layout md-gutter">
        <div class="md-layout-item md-size-100">
          <credential></credential>
        </div>
        <div class="md-layout-item md-size-100 kit-sync">
          <kit-sync></kit-sync>
        </div>
      </div>
    </widget>
  </div>
</template>

<script>
import Credential from "./Credential.vue"
import KitSync from "./KitSync.vue"

import Widget from "@/shared/Widget.vue"

export default {
  name: "Overview",
  components: { Widget, Credential, KitSync },
  data() {
    return {}
  },
  mounted() {},
  methods: {},
}
</script>

<style scoped lang="scss">
.kit-sync {
  margin-top: 2rem;
}
</style>
