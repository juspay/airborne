Pod::Spec.new do |s|
  s.name             = 'Airborne'
  s.version          = '0.31.1'
  s.summary          = 'An OTA update plugin for Android, iOS and React Native applications.'
  s.description      = <<-DESC
Hyper OTA empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their Android, iOS, and React Native applications.
                       DESC

  s.homepage         = 'https://github.com/juspay/airborne'
  s.license          = { :type => 'Apache 2.0', :file => 'LICENSE' }
  s.author           = { 'Juspay Technologies' => 'pp-sdk@juspay.in' }

  s.source           = { :git => 'https://github.com/juspay/airborne.git', :tag => "#{s.version}" }
  s.platform         = :ios, "12.0"

  s.source_files     = 'Airborne/AirborneObjC/**/*.{h,m}', 'Airborne/AirborneSwift/**/*.swift'
  s.public_header_files = 'Airborne/AirborneObjC/include/*.h'
  s.module_map       = 'Airborne/Airborne.modulemap'

  s.swift_version    = '5.0'
  s.static_framework = true
end
