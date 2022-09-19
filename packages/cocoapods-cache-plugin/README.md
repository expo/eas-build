# cocoapods-cache-plugin

This plugin takes care about adding our Nexus3 Cocoapods cache instance as a source, depending on
`COCOAPODS_CACHE_URL` value. If this environment variable is set, once you run `pod install` command
this whole process will happen automatically. It doesn't require any changes to `Podfile` of the project.

It also makes sure that pods from `POD_BLACKLIST` list are downloaded through official CocoaPods CDN and not through our cache instance.

Pods on `POD_BLACKLIST` are the pods which causes Nexus3 Cocoapods cache to crash `pod install` process due to unusuall source of the pod.
Sample issue: https://issues.sonatype.org/browse/NEXUS-28026.

Once Sonatype fix this issue on their end, we should be able to get rid of this plugin.

## Installation

```bash
sudo gem build cocoapods-cache-plugin.gemspec --output=cocoapods-cache-plugin.gem
sudo gem install cocoapods-cache-plugin.gem
```

# Usage

Install the plugin and that's it!
