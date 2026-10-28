<template>
  <div class="brand-header">
    <spark-logo class="brand-logo" />
    <h1 class="brand-name">{{ productName }}</h1>
    <div class="brand-powered-by">Powered by {{ poweredBy }}</div>
    <div class="brand-accent-line" />
  </div>
</template>

<script>
import { branding } from "@/branding/index.js"
import SparkLogo from "@/shared/SparkLogo.vue"

export default {
  name: "BrandHeader",
  components: { SparkLogo },
  data() {
    return {
      productName: branding.productName,
      poweredBy: branding.poweredBy,
    }
  },
}
</script>

<style lang="scss" scoped>
.brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1rem 0;
  color: var(--navy);
}

.brand-logo {
  height: 32px;
}

.brand-name {
  margin: 0.75rem 0 0;
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.brand-powered-by {
  color: var(--muted);
  font-size: 0.8rem;
}

.brand-accent-line {
  width: 120px;
  height: 4px;
  margin: 1rem 0 2rem;
  border-radius: 2px;
  background: linear-gradient(to right, var(--green-bright), var(--teal));
}
</style>
