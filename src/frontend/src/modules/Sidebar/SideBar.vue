<template>
  <div class="sidebar" :data-color="sidebarItemColor">
    <!-- Fixed logo section that won't scroll -->
    <div class="logo fixed-logo">
      <div class="brand-column">
        <div class="company-header">
          {{ $store.getters["settings/getMainSettings"].companyName }}
        </div>
        <small class="powered-by">Powered by {{ poweredBy }}</small>
      </div>
    </div>

    <!-- Scrollable wrapper with single scrollbar -->
    <div class="sidebar-wrapper">
      <slot name="content"></slot>
      <md-list class="no-bg p-15" md-expand-single>
        <template v-for="menu in routes">
          <template v-if="shouldRenderMenu(menu)">
            <!-- If the route has no children, then it should be a clickable menu item -->
            <router-link
              v-if="!hasSubMenu(menu)"
              :to="menu.path"
              :key="'menu' + menu.meta?.sidebar?.name ?? menu.path"
            >
              <md-list-item>
                <md-icon v-if="menu.meta?.sidebar?.icon" class="icon-box">
                  {{ menu.meta.sidebar.icon }}
                </md-icon>
                <span class="md-list-item-text">
                  {{ $tc("menu." + menu.meta?.sidebar?.name ?? menu.path) }}
                </span>
              </md-list-item>
            </router-link>

            <!-- If the route has children, then it should be a nested, expanbable list with sub menues -->
            <div
              v-else
              :key="'submenu' + menu.meta?.sidebar?.name ?? menu.path"
            >
              <md-list-item md-expand>
                <md-icon v-if="menu.meta?.sidebar?.icon" class="icon-box">
                  {{ menu.meta.sidebar.icon }}
                </md-icon>
                <span class="md-list-item-text">
                  {{ menu.meta?.sidebar?.name ?? menu.path }}
                </span>
                <md-list slot="md-expand" class="no-bg">
                  <template v-for="sub in menu.children">
                    <router-link
                      v-if="shouldRenderSubMenu(menu, sub)"
                      :key="sub.path"
                      :to="subMenuUrl(menu.path, sub.path)"
                      class="sub-menu"
                    >
                      <md-list-item>
                        <span class="md-list-item-text">
                          {{
                            $tc(
                              "menu.subMenu." + sub.meta?.sidebar?.name ??
                                sub.path,
                            )
                          }}
                        </span>
                      </md-list-item>
                    </router-link>
                  </template>
                </md-list>
              </md-list-item>
            </div>
          </template>
        </template>
      </md-list>
      <!-- Bottom buffer space -->
      <div class="sidebar-bottom-buffer"></div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex"

import { branding } from "@/branding/index.js"
import { getPermissionsForPath } from "@/Helpers/PermissionGuard.js"
import { translateItem } from "@/Helpers/TranslateItem.js"

export default {
  name: "SideBar",

  data() {
    return {
      translateItem: translateItem,
      routes: this.$router.options.routes,
      poweredBy: branding.poweredBy,
    }
  },

  props: {
    title: {
      type: String,
      default: "MicroPowerManager Open Source",
    },
    sidebarBackgroundImage: {
      type: String,
      default: null,
    },
    sidebarItemColor: {
      type: String,
      default: "primary",
    },
    autoClose: {
      type: Boolean,
      default: true,
    },
  },
  provide() {
    return {
      autoClose: this.autoClose,
    }
  },
  async created() {
    await this.$store.dispatch("settings/fetchPlugins")
  },
  methods: {
    isSidebarEnabled(meta = {}) {
      const enabledFlag = meta?.sidebar?.enabled
      const pluginId = meta?.sidebar?.enabled_by_mpm_plugin_id
      const pluginEnabled =
        pluginId && this.getEnabledPlugins.includes(pluginId)
      return Boolean(enabledFlag || pluginEnabled)
    },
    shouldRenderMenu(menu) {
      if (!this.isSidebarEnabled(menu.meta ?? {})) {
        return false
      }
      if (!this.hasSubMenu(menu)) {
        return this.canNavigate(menu.path, menu.meta ?? {})
      }
      return menu.children?.some((sub) => this.shouldRenderSubMenu(menu, sub))
    },
    shouldRenderSubMenu(menu, sub) {
      const enabledFlag = sub.meta?.sidebar?.enabled
      const pluginId = sub.meta?.sidebar?.enabled_by_mpm_plugin_id
      const pluginEnabled =
        pluginId && this.getEnabledPlugins.includes(pluginId)
      if (!enabledFlag && !pluginEnabled) {
        return false
      }
      return this.canNavigate(
        this.subMenuUrl(menu.path, sub.path),
        sub.meta ?? {},
        menu.meta ?? {},
      )
    },
    canNavigate(path, meta = {}, fallbackMeta = {}) {
      let requiredPermissions = getPermissionsForPath(path, meta)
      if (!requiredPermissions.length && Object.keys(fallbackMeta).length) {
        requiredPermissions = getPermissionsForPath(path, fallbackMeta)
      }
      if (!requiredPermissions.length) {
        return true
      }
      return requiredPermissions.every((permission) =>
        this.userPermissions.includes(permission),
      )
    },
    hasSubMenu(menu) {
      // We show a submenu if the menu has children and at least one of them has sidebar enabled
      if (menu.children && menu.children.length > 0) {
        for (let child of menu.children) {
          if (child.meta?.sidebar?.enabled) {
            return true
          }
        }
      }
      return false
    },
    subMenuUrl(basePath, subPath) {
      return `${basePath}/${subPath}`
    },
    translateMenuItem(name) {
      if (this.$tc("menu." + name).search("menu") !== -1) {
        return name
      } else {
        return this.$tc("menu." + name)
      }
    },
  },
  computed: {
    ...mapGetters("settings", ["getEnabledPlugins"]),
    ...mapGetters({
      userPermissions: "auth/getPermissions",
    }),
  },
}
</script>

<style scoped lang="scss">
.sidebar {
  background: var(--panel);
  border-right: 1px solid var(--line);
  box-shadow: none;
  display: flex;
  flex-direction: column;
}

.sidebar-wrapper {
  position: relative;
  z-index: 4;
  .dropdown .dropdown-backdrop {
    display: none !important;
  }

  .navbar-form {
    border: none;
  }

  .nav {
    padding: 0;

    [data-toggle="collapse"] ~ div > ul > li > a {
      padding-left: 60px;
    }

    .caret {
      margin-top: 13px;
      position: absolute;
      right: 18px;
    }
  }
}

.logo.fixed-logo {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  padding: 1.25rem 0 1rem;
  width: 100%;
}

.sidebar-bottom-buffer {
  height: 30px;
}

.brand-column {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

@media screen and (min-width: 991px) {
  .brand-column {
    padding-left: 1rem !important;
  }
}

.md-list-item-text {
  font-size: 0.875rem;
  font-weight: 400;
}

@media screen and (min-width: 991px) {
  .nav-mobile-menu {
    display: none;
  }
}

.company-header {
  color: var(--ink);
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 600;
}

.powered-by {
  color: var(--muted);
  font-size: 0.7rem;
}

.md-list-item ::v-deep .md-list-item-container {
  border-radius: var(--radius-control);
  margin: 1px 0;
}

.active ::v-deep .md-list-item-container {
  background: var(--sage);

  .md-list-item-text,
  .md-icon {
    color: var(--sage-ink);
    font-weight: 500;
  }
}

.no-bg {
  background-color: transparent !important;
}

.icon-box {
  margin-right: 10px !important;
  width: 25px !important;
  height: 25px !important;
}

.sub-menu {
  width: 100% !important;
}

.p-15 {
  padding: 10px;
}
</style>
