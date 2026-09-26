Pod::Spec.new do |s|
  s.name           = 'IsaiAudio'
  s.version        = '0.1.0'
  s.summary        = 'Isai playback engine'
  s.description    = 'Background music playback with lock-screen and remote controls for the Isai music player.'
  s.author         = 'Isai'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '17.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'AVKit', 'MediaPlayer', 'MediaToolbox'

  # Swift 5 language mode: strict Swift 6 concurrency checks are warnings, not errors.
  s.swift_version = '5.9'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
