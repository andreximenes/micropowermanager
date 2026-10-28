<template>
  <!-- Inline, not an <img>, so the wordmark can take the color of where it sits. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 166.92 32.16"
    role="img"
    aria-label="Spark"
    class="spark-logo"
  >
    <polygon
      points="31.34 1.37 7.42 1.37 0 8.79 0 14.27 7.42 21.69 0 21.69 0 32.16 23.93 32.16 31.34 24.74 31.34 19.26 23.93 11.84 31.34 11.84 31.34 1.37"
    />
    <polygon
      points="58.02 1.37 34.09 1.37 34.09 32.16 49.48 32.16 49.48 24.46 58.02 24.46 65.44 17.05 65.44 8.79 58.02 1.37"
    />
    <polygon
      points="104.49 1.37 104.49 32.16 135.08 32.16 129.67 22.45 135.08 17.05 135.08 8.79 127.66 1.37 104.49 1.37"
    />
    <polygon
      points="166.92 1.37 138.2 1.37 138.2 32.16 166.92 32.16 157.71 16.77 166.92 1.37"
    />
    <polygon
      points="84.26 0 66.81 17.45 66.81 32.16 101.71 32.16 101.71 17.45 84.26 0"
    />
  </svg>
</template>

<script>
export default {
  name: "SparkLogo",
}
</script>

<style lang="scss" scoped>
.spark-logo {
  height: 26px;
  width: auto;
  fill: currentColor;
}
</style>
