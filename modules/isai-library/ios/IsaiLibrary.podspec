Pod::Spec.new do |s|
  s.name           = 'IsaiLibrary'
  s.version        = '0.1.0'
  s.summary        = 'Isai music library access'
  s.description    = 'Folder bookmarks, audio file listing and tag reading for the Isai music player.'
  s.author         = 'Isai'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '17.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'UniformTypeIdentifiers'

  # Swift 5 language mode: strict Swift 6 concurrency checks are warnings, not errors.
  s.swift_version = '5.9'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
