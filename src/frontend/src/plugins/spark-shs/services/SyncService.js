import SyncRepository from "../repositories/SyncRepository.js"

import { ErrorHandler } from "@/Helpers/ErrorHandler.js"

export class SyncService {
  constructor() {
    this.repository = SyncRepository
    this.settings = {
      isEnabled: false,
      intervalHours: 24,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncResult: null,
    }
    this.mappings = []
  }

  settingsFromJson(data) {
    this.settings = {
      isEnabled: data.is_enabled,
      intervalHours: data.interval_hours,
      lastSyncAt: data.last_sync_at,
      lastSyncStatus: data.last_sync_status,
      lastSyncResult: data.last_sync_result,
    }
    return this.settings
  }

  mappingFromJson(data) {
    return {
      id: data.id,
      pattern: data.pattern,
      applianceId: data.appliance_id,
      savedApplianceId: data.appliance_id,
      applianceName: data.appliance?.name,
    }
  }

  async getSettings() {
    try {
      const { data } = await this.repository.getSettings()
      return this.settingsFromJson(data.data)
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async updateSettings() {
    try {
      const { data } = await this.repository.updateSettings({
        is_enabled: this.settings.isEnabled,
        interval_hours: Number(this.settings.intervalHours),
      })
      return this.settingsFromJson(data.data)
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async syncNow() {
    try {
      await this.repository.syncNow()
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async getMappings() {
    try {
      const { data } = await this.repository.listMappings()
      this.mappings = data.data.map((mapping) => this.mappingFromJson(mapping))
      return this.mappings
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async createMapping(pattern, applianceId) {
    try {
      await this.repository.createMapping({
        pattern,
        appliance_id: applianceId,
      })
      // The backend decides the matching order, so reload instead of appending.
      return await this.getMappings()
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async updateMappingAppliance(mapping) {
    try {
      const { data } = await this.repository.updateMapping(mapping.id, {
        appliance_id: mapping.applianceId,
      })
      Object.assign(mapping, this.mappingFromJson(data.data))
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }

  async deleteMapping(id) {
    try {
      await this.repository.deleteMapping(id)
      this.mappings = this.mappings.filter((mapping) => mapping.id !== id)
    } catch (e) {
      return new ErrorHandler(e.response?.data?.message ?? e.message, "http")
    }
  }
}
