# Local Expo Module (aria-musickit). Autolinked from ./modules by expo-modules-autolinking (no package.json needed).
Pod::Spec.new do |s|
  s.name           = 'AriaMusicKit'
  s.version        = '0.1.0'
  s.summary        = 'Aria aria-musickit native module'
  s.description    = 'Aria aria-musickit native module (see docs/ARCHITECTURE.md §8)'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Aria'
  s.homepage       = 'https://example.invalid/aria'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MusicKit', 'MediaPlayer'

  s.source_files = '**/*.{h,m,swift}'
  s.exclude_files = 'Tests/**/*'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
