require 'cocoapods-nexus-plugin/command'
require 'fileutils'

POD_BLACKLIST = [
  "libwebp",
  "Braintree",
  "razorpay-pod",
  "TrezorCrypto",
  "MapboxCommon",
  "MapboxCoreMaps",
  "CFSDK",
  "MapboxMobileEvents",
  "Mapbox-iOS-SDK",
  "MapboxNavigationNative",
  "MapboxNavigation",
  "MapboxCoreNavigation",
  "MapboxSpeech"
]

NEXUS_COCOAPODS_REPO_URL = ENV['NEXUS_COCOAPODS_REPO_URL']

module Pod
  class Installer
    class Analyzer
      @@_was_using_cocoapods_cache_printed = false

      alias_method :orig_sources, :sources

      # add our own source to the list of sources
      def sources
        if NEXUS_COCOAPODS_REPO_URL
          puts "Using CocoaPods cache: #{NEXUS_COCOAPODS_REPO_URL}" unless @@_was_using_cocoapods_cache_printed
          @@_was_using_cocoapods_cache_printed = true

          sources = podfile.sources

          if sources.include?(Pod::TrunkSource::TRUNK_REPO_URL)
            sources[sources.index(Pod::TrunkSource::TRUNK_REPO_URL)] = NEXUS_COCOAPODS_REPO_URL
          else
            sources = [NEXUS_COCOAPODS_REPO_URL].concat(sources)
          end

          # Fragment below comes from the original sources method located https://github.com/CocoaPods/CocoaPods/blob/master/lib/cocoapods/installer/analyzer.rb

          #################################################################
          plugin_sources = @plugin_sources || []

          # Add any sources specified using the :source flag on individual dependencies.
          dependency_sources = podfile_dependencies.map(&:podspec_repo).compact

          sources += dependency_sources

          result = sources.uniq.map do |source_url|
            sources_manager.find_or_create_source_with_url(source_url)
          end
          unless plugin_sources.empty?
            result.insert(0, *plugin_sources)
            plugin_sources.each do |source|
              sources_manager.add_source(source)
            end
          end
          result
          #################################################################
        else
          orig_sources
        end
      end
    end
  end
end

module Pod
  class CDNSource
    @@_detected_unsupported_pods = []

    # Override method which downloads podspec to use CDN if pod is not supported by Nexus3 cache instance
    # https://github.com/CocoaPods/Core/blob/master/lib/cocoapods-core/cdn_source.rb
    _original_download_and_save_with_retries_async = instance_method(:download_and_save_with_retries_async)
    define_method(:download_and_save_with_retries_async) do |partial_url, file_remote_url, etag, retries = MAX_NUMBER_OF_RETRIES|
      if NEXUS_COCOAPODS_REPO_URL and file_remote_url.include?(self.url()) and self.url() == NEXUS_COCOAPODS_REPO_URL
        detected_unsupported_pod = nil
        POD_BLACKLIST.each do |item|
          if file_remote_url.include?(item)
            detected_unsupported_pod = item
            break
          end
        end

        if detected_unsupported_pod
          if not @@_detected_unsupported_pods.include?(detected_unsupported_pod)
            puts "detected #{detected_unsupported_pod}, using CocoaPods CDN to fetch its podspec..."
            @@_detected_unsupported_pods.push(detected_unsupported_pod)
          end
          _original_download_and_save_with_retries_async.bind(self).(partial_url, "#{Pod::TrunkSource::TRUNK_REPO_URL}/#{partial_url}", etag, retries)
        else
          _original_download_and_save_with_retries_async.bind(self).(partial_url, file_remote_url, etag, retries)
        end
      else
        _original_download_and_save_with_retries_async.bind(self).(partial_url, file_remote_url, etag, retries)
      end
    end
  end
end
