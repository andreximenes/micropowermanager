<template>
  <footer class="footer">
    <span>{{ productName }}</span>
    <span class="separator">·</span>
    <span>
      Powered by
      <a :href="poweredByUrl" target="_blank" rel="noopener noreferrer">
        {{ poweredBy }}
      </a>
    </span>
  </footer>
</template>

<script>
import { branding } from "@/branding/index.js"

export default {
  name: "FooterBar",
  data() {
    return {
      productName: branding.productName,
      poweredBy: branding.poweredBy,
      poweredByUrl: branding.poweredByUrl,
    }
  },
}
</script>

<style lang="scss" scoped>
.footer {
  padding: 1rem 1.5rem;
  color: var(--muted);
  font-size: 0.75rem;
  text-align: right;

  a {
    color: var(--muted);
    text-decoration: underline;
  }
}

.separator {
  margin: 0 0.5rem;
}
</style>
