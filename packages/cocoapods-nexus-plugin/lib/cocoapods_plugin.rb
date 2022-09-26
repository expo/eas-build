require 'cocoapods-nexus-plugin/command'
require 'fileutils'

CDN_URL = "https://cdn.cocoapods.org"

POD_BLACKLIST = ["libwebp", "Braintree", "razorpay-pod", "TrezorCrypto", "MapboxCommon"]

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

          # create folder for our source
          repo_path = "#{Pod::Config.instance.home_dir}/repos/cocoapods-cache"
          FileUtils.mkdir_p(repo_path) unless Dir.exist?(repo_path)

          # create .url file in this folder which is used by CocoaPods to determine the source URL
          File.write("#{repo_path}/.url", NEXUS_COCOAPODS_REPO_URL)

          if sources.include?(CDN_URL)
            sources[sources.index(CDN_URL)] = Pod::CDNSource.new(repo_path)
          else
            sources = [Pod::CDNSource.new(repo_path)].concat(sources)
          end

          @sources = sources
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
          _original_download_and_save_with_retries_async.bind(self).(partial_url, "#{CDN_URL}/#{partial_url}", etag, retries)
        else
          _original_download_and_save_with_retries_async.bind(self).(partial_url, file_remote_url, etag, retries)
        end
      else
        _original_download_and_save_with_retries_async.bind(self).(partial_url, file_remote_url, etag, retries)
      end
    end
  end
end
