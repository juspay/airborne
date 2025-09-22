Pod::Spec.new do |s|
  s.name             = 'Airborne'
  s.version          = '0.0.6'
  s.summary          = 'An OTA update plugin for Android, iOS and React Native applications.'
  s.description      = <<-DESC
Hyper OTA empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their Android, iOS, and React Native applications.
Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.
                       DESC

  s.homepage         = 'https://github.com/juspay/airborne'
  s.license          = { :type => 'Apache 2.0', :file => 'airborne_sdk_iOS/hyper-ota/LICENSE' }
  s.author           = { 
    'Juspay Technologies' => 'pp-sdk@juspay.in'
  }
  
  s.source = {
    :git  => 'https://github.com/juspay/airborne.git',
    :tag  => "v#{s.version}"
  }

  s.source_files       = 'airborne_sdk_iOS/hyper-ota/Airborne/Classes/**/*.{h,m,swift}'
  s.module_map         = 'airborne_sdk_iOS/hyper-ota/Airborne.modulemap'
  s.public_header_files = 'airborne_sdk_iOS/hyper-ota/Airborne/Classes/**/*.h'

  s.platform     = :ios, "12.0"
  s.dependency 'HyperCore', '0.1.4'
  s.swift_versions = ['5.0']
end