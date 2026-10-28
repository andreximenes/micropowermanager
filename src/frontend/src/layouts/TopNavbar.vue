<template>
  <header class="spark-topbar">
    <md-toolbar md-elevation="0" class="spark-topbar-toolbar">
      <div class="md-toolbar-row">
        <div class="md-toolbar-section-start">
          <router-link to="/" class="spark-brand">
            <spark-logo />
            <span class="spark-brand-name">{{ productName }}</span>
          </router-link>
          <breadcrumb />
        </div>

        <div class="md-toolbar-section-end">
          <div>
            <md-menu md-direction="bottom-end" md-size="big" class="menu-item">
              <md-button class="md-dense nav-button md-raised" md-menu-trigger>
                <md-tooltip md-direction="bottom">
                  {{ $tc("words.location", 2) }}
                </md-tooltip>
                <md-icon>add_location_alt</md-icon>
                <small>{{ $tc("words.location", 2) }}</small>
              </md-button>
              <md-menu-content>
                <md-menu-item disabled>
                  <span>{{ $tc("words.location", 2) }}</span>
                  <md-icon>add_location_alt</md-icon>
                </md-menu-item>
                <md-divider></md-divider>
                <md-menu-item @click="navigateRoute('/locations/add-cluster')">
                  {{ $tc("menu.subMenu.addCluster") }}
                </md-menu-item>
                <md-menu-item
                  @click="navigateRoute('/locations/add-mini-grid')"
                >
                  {{ $tc("menu.subMenu.addSite") }}
                </md-menu-item>
                <md-menu-item @click="navigateRoute('/locations/add-village')">
                  {{ $tc("menu.subMenu.addVillage") }}
                </md-menu-item>
                <md-menu-item @click="navigateRoute('/locations/villages')">
                  {{ $tc("menu.subMenu.manageVillages") }}
                </md-menu-item>
              </md-menu-content>
            </md-menu>
            <md-menu class="menu-item" md-direction="bottom-end" md-size="big">
              <md-button class="md-dense nav-button md-raised" md-menu-trigger>
                <md-tooltip md-direction="bottom">
                  {{ $tc("menu.subMenu.Config") }}
                </md-tooltip>
                <md-icon>settings</md-icon>
                <small>{{ $tc("menu.subMenu.Config") }}</small>
              </md-button>
              <md-menu-content>
                <md-menu-item disabled>
                  <span>{{ $tc("menu.subMenu.Config") }}</span>
                  <md-icon>settings</md-icon>
                </md-menu-item>
                <md-divider></md-divider>
                <md-menu-item @click="navigateRoute('/settings/configuration')">
                  <span>{{ $tc("menu.subMenu.Settings") }}</span>
                </md-menu-item>
                <md-menu-item @click="navigateRoute('/settings/import')">
                  <span>Import</span>
                </md-menu-item>
                <md-menu-item
                  @click="navigateRoute('/settings/user-management')"
                >
                  {{ $tc("phrases.userManagement") }}
                </md-menu-item>
                <md-menu-item disabled="">
                  <span>{{ $tc("words.connection") }}</span>
                  <md-icon>cast</md-icon>
                </md-menu-item>
                <md-menu-item
                  @click="navigateRoute('/settings/connection-groups')"
                >
                  {{ $tc("words.group", 2) }}
                </md-menu-item>
                <md-menu-item
                  @click="navigateRoute('/settings/connection-types')"
                >
                  {{ $tc("words.type", 2) }}
                </md-menu-item>
              </md-menu-content>
            </md-menu>
            <md-menu class="menu-item" md-direction="bottom-end" md-size="big">
              <md-button class="nav-button md-raised md-dense" md-menu-trigger>
                <md-icon>person</md-icon>
                <small>{{ adminName }}</small>
                <md-icon>keyboard_arrow_down</md-icon>
              </md-button>
              <md-menu-content>
                <div class="author-card">
                  <div class="md-layout">
                    <md-icon>account_circle</md-icon>
                  </div>
                  <div class="md-layout md-alignment-center">
                    {{ adminName }}
                  </div>
                  <hr />
                </div>
                <md-menu-item @click="navigateRoute('/profile')">
                  {{ $tc("words.profile") }}
                </md-menu-item>
                <md-menu-item @click="logout()">
                  {{ $tc("phrases.logOut") }}
                </md-menu-item>
              </md-menu-content>
            </md-menu>
          </div>
        </div>
      </div>
    </md-toolbar>
    <div class="spark-accent-line" />
  </header>
</template>

<script>
import Breadcrumb from "../shared/Breadcrumb.vue"

import { branding } from "@/branding/index.js"
import SparkLogo from "@/shared/SparkLogo.vue"

export default {
  components: {
    Breadcrumb,
    SparkLogo,
  },
  data() {
    return {
      productName: branding.productName,
      open: false,
      toggleCard: false,
    }
  },
  methods: {
    logout() {
      this.$store.dispatch("auth/logOut").then(() => {
        this.$router.replace("/login")
      })
    },
    toggle() {
      this.toggleCard = !this.toggleCard
    },
    navigateRoute(route) {
      this.$router.push(route).catch(() => {})
    },
  },
  computed: {
    adminName() {
      return this.$store.getters["auth/getAuthenticateUser"].name
    },
  },
}
</script>

<style scoped lang="scss">
.spark-topbar-toolbar.md-toolbar.md-theme-default {
  background: var(--topbar-bg);

  * {
    color: #fff;
  }
}

.spark-accent-line {
  height: 4px;
  background: linear-gradient(to right, var(--green-bright), var(--teal));
}

.spark-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-right: 1.5rem;
  color: var(--logo-fill);
  text-decoration: none;

  &:hover {
    text-decoration: none;
  }
}

.spark-brand-name {
  font-family: var(--font-heading);
  font-size: 1rem;
  white-space: nowrap;
}

.md-button.md-theme-default.md-raised.nav-button {
  background-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
  border: 1px solid var(--toggle-ring);
}

.menu-item {
  padding-right: 1vh;
}

.author-card {
  min-width: 30% !important;
  text-align: center;
  color: var(--ink);
  font-size: 1rem;
  font-weight: 300;
  padding: 1vh;
  margin-top: 0;
}
</style>
