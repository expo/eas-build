# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'cocoapods-proxy-plugin/gem_version.rb'

Gem::Specification.new do |spec|
  spec.name          = 'cocoapods-cache-plugin'
  spec.version       = CocoapodsProxyPlugin::VERSION
  spec.authors       = ['Expo']
  spec.email         = ['support@expo.dev']
  spec.description   = "CocoaPods plugin, which handles fetching the pods which are not supported by Nexus3 cocoapods-proxy repository."
  spec.summary       = "CocoaPods plugin, which handles fetching the pods which are not supported by Nexus3 cocoapods-proxy repository."
  spec.homepage      = 'https://github.com/expo/eas-build/packages/cocoapods-proxy-plugin'
  spec.license       = 'BUSL-1.1'

  spec.files         = Dir['lib/**/*']
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ['lib']

  spec.add_development_dependency 'bundler', '~> 1.3'
  spec.add_development_dependency 'rake', '~> 12.0'
end
