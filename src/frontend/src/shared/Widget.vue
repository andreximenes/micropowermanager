<template>
  <div class="spark-widget">
    <div v-if="title !== null" class="widget-header">
      <h2 class="widget-title">{{ title }}</h2>
      <div class="widget-actions">
        <slot name="tabbar"></slot>
        <label v-if="search" class="widget-search">
          <md-icon>search</md-icon>
          <input
            v-model="searchTerm"
            type="search"
            :placeholder="$tc('words.search')"
          />
          <md-button
            v-if="searching"
            class="md-icon-button md-dense"
            @click="showAllEntries"
          >
            <md-icon>close</md-icon>
          </md-button>
        </label>
        <md-button
          v-if="showRefreshButton"
          @click="refreshButtonClicked"
          class="md-icon-button md-dense"
          :class="{ 'refresh-button': isActive }"
        >
          <md-tooltip md-direction="top">
            {{ $tc("words.refresh") }}
          </md-tooltip>
          <md-icon>cached</md-icon>
        </md-button>
        <md-button
          v-if="buttonText !== null"
          @click="widgetAction"
          class="md-raised md-primary md-dense widget-action"
        >
          <md-icon>{{ buttonIcon }}</md-icon>
          {{ buttonText }}
        </md-button>
      </div>
    </div>
    <div class="widget-body">
      <div v-if="showData">
        <slot></slot>
      </div>
      <div v-else name="emptyState">
        <div v-if="showEmptyState" name="emptyState" class="empty-state">
          <md-empty-state
            :md-icon="icon"
            :md-description="emptyStateDescription"
            :md-label="getEmptyStateLabel"
          >
            <md-button
              v-if="button && emptyStateCreateButton"
              @click="widgetAction"
              class="md-primary md-raised"
            >
              {{ getEmptyStateButtonText }}
            </md-button>
          </md-empty-state>
        </div>
        <loader v-else />
      </div>
    </div>
    <div v-if="paginator" class="widget-footer">
      <paginate
        :paginatorReference="paginator"
        :route_name="route_name"
        :show_per_page="show_per_page"
        :subscriber="subscriber"
        :key="resetKey"
      ></paginate>
    </div>
  </div>
</template>

<script>
import Loader from "./Loader.vue"
import Paginate from "./Paginate.vue"

import { Paginator } from "@/Helpers/Paginator.js"
import { EventBus } from "@/shared/eventbus.js"

const debounce = require("debounce")
export default {
  name: "Widget",
  components: { Loader, Paginate },

  props: {
    emptyStateCreateButton: {
      type: Boolean,
      default: true,
    },
    emptyStateDescription: {
      type: String,
      default: null,
    },
    buttonIcon: {
      type: String,
      default: "add",
    },
    showRefreshButton: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: null,
    },
    id: String,
    button: Boolean,
    buttonText: {
      type: String,
      default: null,
    },
    paginator: Paginator,
    search: {},
    subscriber: {
      type: String,
    },
    route_name: String,
    headless: {
      type: Boolean,
      default: false,
    },
    show_per_page: {
      type: Boolean,
      default: false,
    },
    resetKey: {
      default: 0,
    },
  },

  mounted() {
    //listen for a remote trigger for ending the search
    EventBus.$on("search.end", this.cancelSearching)
    EventBus.$on("hideEmptyStateArea", this.hideEmptyStateArea)
    if (this.subscriber === null || this.subscriber === undefined) {
      return (this.showData = true)
    } else {
      EventBus.$on("widgetContentLoaded", this.checkDataLength)
    }
  },

  beforeDestroy() {
    EventBus.$off("search.end", this.cancelSearching)
    EventBus.$off("hideEmptyStateArea", this.hideEmptyStateArea)
    EventBus.$off("widgetContentLoaded", this.checkDataLength)
  },
  data() {
    return {
      searching: false,
      searchTerm: "",
      icon: "post_add",
      showEmptyState: false,
      showData: false,
      isActive: false,
    }
  },
  methods: {
    hideEmptyStateArea(subscriber) {
      if (!this.validateSubscriber(subscriber)) {
        return
      }
      this.showData = true
      this.showEmptyState = false
    },
    refreshButtonClicked() {
      this.isActive = true
      this.$emit("refreshButtonClicked")
    },
    widgetAction() {
      this.$emit("widgetAction", this.subscriber)
    },
    validateSubscriber(subscriber) {
      return this.subscriber === subscriber
    },
    checkDataLength(subscriber, dataLength) {
      if (!this.validateSubscriber(subscriber)) {
        return
      }
      if (dataLength === 0) {
        this.showData = false
        this.showEmptyState = true
      } else if (dataLength === null || dataLength === undefined) {
        this.showData = false
        this.showEmptyState = false
      } else {
        this.showData = true
        this.showEmptyState = false
      }
    },
    defaultCallback() {
      alert("default button click")
    },
    doSearch(data) {
      this.searching = true
      EventBus.$emit("searching", data)
    },
    showAllEntries() {
      this.searching = false
      this.searchTerm = ""
      EventBus.$emit("end_searching")
    },
    cancelSearching() {
      this.searching = false
      this.searchTerm = ""
    },
  },
  computed: {
    getEmptyStateLabel() {
      if (this.title === null || this.title === undefined) {
        return this.$tc("phrases.noData", 2)
      } else {
        return this.$tc("phrases.noDataFoundFor", 1, {
          data: this.title,
        })
      }
    },
    getEmptyStateButtonText() {
      if (this.title === null || this.title === undefined) {
        return this.$tc("phrases.createFirsRecord", 1)
      } else {
        return this.$tc("phrases.createFirsRecord", 2, {
          data: this.title,
        })
      }
    },
  },
  watch: {
    searchTerm: debounce(function () {
      if (this.searchTerm.length > 0) {
        this.doSearch(this.searchTerm)
      }
      if (this.searching && this.searchTerm.length == 0) {
        this.showAllEntries()
      }
    }, 1000),
  },
}
</script>

<style lang="scss" scoped>
.refresh-button {
  animation: rotate 1.4s ease 0.5s;
}

@keyframes rotate {
  0% {
    transform: rotate(360deg);
  }
}

// Spark card: title and actions live inside the card, like the Hub's Card.
.spark-widget {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
  margin-bottom: 1.5rem;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  min-height: 64px;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--line);
}

// Wide tables scroll inside the card instead of being clipped by it.
.widget-body {
  overflow-x: auto;
  border-radius: 0 0 var(--radius) var(--radius);
}

.widget-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.widget-search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 36px;
  width: 240px;
  padding: 0 0.5rem;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-control);

  &:focus-within {
    border-color: var(--focus);
  }

  .md-icon {
    color: var(--muted);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 0.875rem;
  }
}

.widget-action .md-icon {
  margin-right: 0.25rem;
}

.widget-footer {
  border-top: 1px solid var(--line);
  padding: 0 0.75rem;
}

.full-width-input-with-icon {
  width: calc(100% - 32px) !important;
}

.full-width-input-with-ending-icon {
  width: calc(100% - 70px) !important;
}

.full-width-input {
  width: calc(100%) !important;
}

.pointer {
  cursor: pointer;
}

.empty-state {
  width: 100%;
  height: 20%;
  margin: auto;
}
</style>
