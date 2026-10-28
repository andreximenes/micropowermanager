import Client from "@/repositories/Client/AxiosClient.js"

const resource = `/api/spark-shs/sync`

export default {
  getSettings() {
    return Client.get(`${resource}/settings`)
  },
  updateSettings(settings) {
    return Client.put(`${resource}/settings`, settings)
  },
  syncNow() {
    return Client.post(`${resource}`)
  },
  listMappings() {
    return Client.get(`${resource}/kit-type-mappings`)
  },
  createMapping(mapping) {
    return Client.post(`${resource}/kit-type-mappings`, mapping)
  },
  updateMapping(id, mapping) {
    return Client.put(`${resource}/kit-type-mappings/${id}`, mapping)
  },
  deleteMapping(id) {
    return Client.delete(`${resource}/kit-type-mappings/${id}`)
  },
}
