# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'cocoapods-nexus-plugin/gem_version.rb'

Gem::Specification.new do |spec|
  spec.name          = 'cocoapods-nexus-plugin'
  spec.version       = CocoapodsNexusPlugin::VERSION
  spec.authors       = ['Expo']
  spec.email         = ['support@expo.dev']
  spec.description   = "CocoaPods Nexus plugin overrides the official CDN with the address of the proxy instance. Pods not supported by Nexus will be fetched from the upstream repository."
  spec.summary       = "CocoaPods Nexus plugin overrides the official CDN with the address of the proxy instance. Pods not supported by Nexus will be fetched from the upstream repository."
  spec.homepage      = 'https://github.com/expo/eas-build/packages/cocoapods-nexus-plugin'
  spec.license       = 'BUSL-1.1'

  spec.files         = Dir['lib/**/*']
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ['lib']

  spec.add_development_dependency 'bundler', '~> 1.3'
  spec.add_development_dependency 'rake', '~> 12.0'
end
