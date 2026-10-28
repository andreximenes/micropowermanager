<template>
  <div class="welcome">
    <div class="content">
      <brand-header />

      <p class="cloud-description">
        Manage customers, devices and payments in one place.
      </p>
      <div class="md-layout md-gutter">
        <div class="md-layout-item">
          <md-button class="md-primary md-raised" to="/register">
            <md-icon>person_add</md-icon>
            Register
          </md-button>
        </div>
        <div class="md-layout-item">
          <md-button class="md-raised" to="/login">
            <md-icon>login</md-icon>
            {{ $tc("phrases.signIn") }}
          </md-button>
        </div>
      </div>

      <p class="cloud-description">
        The companion mobile app for agents and customer registration is
        available on Google Play and the App Store:
      </p>
      <div class="router-box">
        Download Field App
        <div class="app-links">
          <a
            href="https://play.google.com/store/apps/details?id=io.micropowermanager.fieldapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="store-badge"
              alt="Get it on Google Play"
              :src="googlePlayBadge"
            />
          </a>
          <a
            href="https://apps.apple.com/ng/app/mpm-field-app/id6809758728"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="store-badge"
              alt="Download on the App Store"
              :src="appStoreBadge"
            />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import appStoreBadge from "@/assets/icons/app-store.svg"
import googlePlayBadge from "@/assets/icons/google-store.svg"
import { config } from "@/config.js"
import BrandHeader from "@/shared/BrandHeader.vue"
export default {
  name: "WelcomePage",
  components: { BrandHeader },
  data() {
    return {
      appStoreBadge: appStoreBadge,
      googlePlayBadge: googlePlayBadge,
    }
  },
  created() {
    // In the Demo environment the company registration page is hidden
    if (config.mpmEnv === "demo") {
      this.$router.push("/login")
    }
  },
}
</script>

<style lang="scss" scoped>
.welcome {
  background: var(--background);
  display: flex;
  flex-direction: column;
  align-items: center;

  width: 100vw;
  min-height: 100vh;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 720px;
  text-align: center;
  margin-top: 8rem;
  padding: 0 1rem;
}

.cloud-description {
  text-align: center;
  padding: 15px;
  font-size: 16px;
  font-weight: 500;
}

.router-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 1rem;
}

.app-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.store-badge {
  display: block;
  height: 32px;
  width: auto;
}

@media (max-width: 768px) {
  .content {
    margin-top: 4rem;
  }
}
</style>
