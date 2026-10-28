<template>
  <div class="forgot-password">
    <div>
      <div class="header">
        <brand-header />
        <h5 class="subtitle">{{ $tc("phrases.forgotPassword") }}</h5>
      </div>
      <div class="content">
        <form
          class="md-layout"
          @submit.prevent="sendForgotPassword"
          data-vv-scope="form-forgot"
        >
          <md-card class="md-layout-item">
            <md-card-header>
              <div class="">
                <div class="subtitle">
                  {{ $tc("phrases.forgotPassword", 2) }}
                </div>
              </div>
            </md-card-header>
            <md-card-content>
              <md-field
                :class="{
                  'md-invalid': errors.has('form-forgot.email'),
                }"
              >
                <label>{{ $tc("words.email") }}</label>
                <md-input
                  type="email"
                  name="email"
                  id="email"
                  autocomplete="email"
                  v-model="email"
                  :v-validate="'required|email'"
                />
                <span class="md-error">
                  {{ errors.first("form-forgot.email") }}
                </span>
              </md-field>
            </md-card-content>

            <md-progress-bar md-mode="indeterminate" v-if="sending" />

            <md-card-actions>
              <md-button
                type="submit"
                class="md-primary md-raised"
                :disabled="sending"
              >
                {{ $tc("words.send") }}
              </md-button>
            </md-card-actions>
          </md-card>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { notify } from "@/mixins/notify.js"
import { UserPasswordService } from "@/services/UserPasswordService.js"
import BrandHeader from "@/shared/BrandHeader.vue"

export default {
  name: "ForgotPassword",
  components: { BrandHeader },
  mixins: [notify],
  data: () => ({
    email: null,
    sending: false,
    userPasswordService: new UserPasswordService(),
  }),
  methods: {
    async sendForgotPassword() {
      let validation = await this.$validator.validateAll("form-forgot")
      if (!validation) {
        return
      }
      try {
        let response = await this.userPasswordService.forgotPassword(this.email)
        if (response.status_code === 200) {
          this.alertNotify(
            "success",
            "If the email exists, a reset link has been sent.",
          )
          setTimeout(() => {
            this.$router.push("/")
          }, 1500)
        } else {
          this.alertNotify("error", response.message.email)
        }
        this.sending = false
      } catch (error) {
        if (error.status_code === 404) {
          this.alertNotify("error", "Email address not recognized")
        } else {
          this.alertNotify("error", error)
        }
        this.sending = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.forgot-password {
  background: var(--background);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  width: 100vw;
  min-height: 100vh;
}

.title {
  text-align: center;
  font-size: x-large;
  padding: 1rem 1rem 0 1rem;
  margin-bottom: 0;
  font-weight: bold;
}

.subtitle {
  text-align: center;
  color: var(--muted);
  margin-top: 5px;
  margin-bottom: 0;
}

.description {
  text-align: center;
  background-color: var(--red);
  padding: 15px;
  color: white;
}
</style>
