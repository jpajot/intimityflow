import { base44 } from "@/api/base44Client";

let configCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getFieldConfigs() {
  const now = Date.now();
  if (configCache && now - cacheTimestamp < CACHE_TTL) {
    return configCache;
  }
  configCache = await base44.entities.EntityFieldConfig.list("field_name", 500);
  cacheTimestamp = now;
  return configCache;
}

export async function isFieldVisible(entityName, fieldName, entityType) {
  const configs = await getFieldConfigs();
  const config = configs.find((c) => c.entity_name === entityName && c.field_name === fieldName);
  
  if (!config) return true; // Default: show field if no config exists
  if (!config.visible_for_types || config.visible_for_types.length === 0) return false;
  
  return config.visible_for_types.includes(entityType);
}

export async function getVisibleFields(entityName, entityType, allFields) {
  const configs = await getFieldConfigs();
  const visible = [];
  
  for (const field of allFields) {
    const config = configs.find((c) => c.entity_name === entityName && c.field_name === field);
    if (!config || !config.visible_for_types || config.visible_for_types.includes(entityType)) {
      visible.push(field);
    }
  }
  
  return visible;
}

export function clearFieldConfigCache() {
  configCache = null;
  cacheTimestamp = 0;
}