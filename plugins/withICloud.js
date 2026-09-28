// @ts-check
/**
 * iCloud Drive documents for optional project sync (ARCHITECTURE.md §8.3, FR-23). OPT-IN:
 *
 *   ["./plugins/withICloud", { "enabled": true }]
 *
 * Adds the iCloud Documents entitlements for one ubiquity container and publishes it in iCloud Drive as
 * "Aria" (NSUbiquitousContainers) so users can see iCloud Drive/Aria/Projects.
 * The container (default `iCloud.<bundleIdentifier>`) must also be created in the Apple developer portal and
 * the iCloud capability (CloudKit not required, "iCloud Documents") enabled on the App ID.
 *
 * Props: { enabled?: boolean = false, containerId?: string, containerName?: string = "Aria",
 *          environment?: 'Development' | 'Production' }  (environment only needed for manual signing setups)
 */
const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

/** @typedef {{ enabled?: boolean; containerId?: string; containerName?: string; environment?: 'Development' | 'Production' }} Props */

/** @type {import('@expo/config-plugins').ConfigPlugin<Props | void>} */
const withICloud = (config, props) => {
  if (!props?.enabled) return config;
  const bundleId = config.ios?.bundleIdentifier;
  if (!props.containerId && !bundleId) {
    throw new Error('withICloud: set ios.bundleIdentifier or pass { containerId }');
  }
  const container = props.containerId ?? `iCloud.${bundleId}`;

  config = withEntitlementsPlist(config, (cfg) => {
    const e = cfg.modResults;
    e['com.apple.developer.icloud-container-identifiers'] = [container];
    e['com.apple.developer.ubiquity-container-identifiers'] = [container];
    e['com.apple.developer.icloud-services'] = ['CloudDocuments'];
    if (props.environment) e['com.apple.developer.icloud-container-environment'] = props.environment;
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    const containers = /** @type {Record<string, any>} */ (cfg.modResults.NSUbiquitousContainers ?? {});
    containers[container] = {
      NSUbiquitousContainerIsDocumentScopePublic: true,
      NSUbiquitousContainerName: props.containerName ?? 'Aria',
      NSUbiquitousContainerSupportedFolderLevels: 'Any',
    };
    cfg.modResults.NSUbiquitousContainers = containers;
    return cfg;
  });

  return config;
};

module.exports = withICloud;
