# Local Expo Module (aria-transcriber). Autolinked from ./modules by expo-modules-autolinking (no package.json needed).
Pod::Spec.new do |s|
  s.name           = 'AriaTranscriber'
  s.version        = '0.1.0'
  s.summary        = 'Aria aria-transcriber native module'
  s.description    = 'Aria aria-transcriber native module (see docs/ARCHITECTURE.md §8)'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Aria'
  s.homepage       = 'https://example.invalid/aria'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreML', 'Accelerate'

  s.source_files = '**/*.{h,m,swift}'
  s.exclude_files = 'Tests/**/*'
  # Basic Pitch (Spotify, Apache-2.0) as plain files: Xcode would otherwise try to compile an .mlpackage in a
  # pod. BasicPitchModel reassembles and compiles it on first use (see BasicPitchModel.swift).
  s.resource_bundles = { 'AriaTranscriberModel' => ['Model/*'] }
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
