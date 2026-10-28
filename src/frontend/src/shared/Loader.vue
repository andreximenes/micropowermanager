<template>
  <div class="loader-container" :class="`loader-${size}`">
    <div class="spark-loader" role="status" aria-label="Loading" />
  </div>
</template>

<script>
export default {
  name: "Loader",
  props: {
    size: {
      type: String,
      default: "md",
      validator: (value) => ["sm", "md"].includes(value),
    },
  },
}
</script>

<style scoped lang="scss">
.loader-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2.5rem 0;
}

.loader-sm {
  padding: 1rem 0;
}

// A thin track with a green-to-teal arc: the conic gradient paints the arc and
// the radial mask cuts the ring out of it.
.spark-loader {
  --loader-size: 40px;
  --loader-thickness: 4px;

  width: var(--loader-size);
  height: var(--loader-size);
  border-radius: 50%;
  background:
    conic-gradient(
      from 0deg,
      transparent 0deg,
      var(--teal) 120deg,
      var(--green-bright) 300deg,
      transparent 300deg
    ),
    var(--line);
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--loader-thickness)),
    #000 calc(100% - var(--loader-thickness) + 1px)
  );
  animation: spark-loader-spin 0.9s linear infinite;
}

.loader-sm .spark-loader {
  --loader-size: 24px;
  --loader-thickness: 3px;
}

@keyframes spark-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spark-loader {
    animation-duration: 2.4s;
  }
}
</style>
