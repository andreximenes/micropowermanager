<template>
  <md-card class="card-list-item-content">
    <div class="card-list-item-header">
      <div class="box" style="font-size: 1.5rem" v-bind:box-color="boxColor">
        <md-icon class="box-icon-glyph">
          {{ boxIcon }}
        </md-icon>
        <slot></slot>
      </div>
    </div>
    <md-card-content>
      <div class="information" style="text-align: end">
        <div class="header-text" v-if="headerText" v-text="headerText"></div>

        <div class="sub-text" v-if="subText" v-html="subText"></div>

        <div
          class="additional-text"
          v-if="additionalText"
          v-html="additionalText"
        ></div>
      </div>
    </md-card-content>
  </md-card>
</template>

<script>
export default {
  name: "Box",
  props: {
    boxColor: {
      type: String,
      default: "default",
    },
    centerText: {
      type: Boolean,
      default: false,
    },
    headerText: String,
    subText: String,
    boxIcon: String,
    additionalText: String,
  },
}
</script>

<style scoped lang="scss">
// Spark icon tile: navy square, the status lives in the icon's color.
.box {
  border-radius: var(--radius);
  padding: 22px;
  margin-top: 1vh;
  background: var(--tile);
  box-shadow: var(--card-shadow);
}

.box-icon-glyph.md-icon {
  color: #fff;
}

.box[box-color="blue"] .box-icon-glyph.md-icon,
.box[box-color="purple"] .box-icon-glyph.md-icon {
  color: var(--teal);
}

.box[box-color="green"] .box-icon-glyph.md-icon {
  color: var(--green-bright);
}

.box[box-color="orange"] .box-icon-glyph.md-icon {
  color: var(--amber-on-navy);
}

.box[box-color="red"] .box-icon-glyph.md-icon {
  color: var(--red-on-navy);
}

.header-text {
  color: var(--muted);
  margin-top: 0px;
  margin-bottom: 1rem;
}

.sub-text {
  color: var(--ink);
  font-family: var(--font-heading);
  font-weight: bold;
  font-size: 1.6rem;
}

.box-icon {
  font-size: 4rem;
}

.text-center {
  text-align: center;
}

.card-list {
  display: -webkit-inline-box !important;
  width: 100%;
}

.card-list-item {
  width: 100% !important;
}

.card-list-item-content {
  width: 100% !important;
}

.card-list-item-header {
  margin-top: -1.8rem;
  margin-left: 15px;
  float: left;
}

@media screen and (max-width: 479px) {
  .card-list-item-content {
    margin-bottom: 1rem !important;
    min-height: unset;
  }
}

@media screen and (min-width: 640px) {
  .card-list-item-content {
    min-height: 100% !important;
  }
}
</style>
