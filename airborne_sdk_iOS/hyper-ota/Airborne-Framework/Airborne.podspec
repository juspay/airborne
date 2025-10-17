Pod::Spec.new do |s|
  s.name             = 'Airborne'
  s.version          = '0.10.1'
  s.summary          = 'An OTA update plugin for Android, iOS and React Native applications.'
  s.description      = <<-DESC
Hyper OTA empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their Android, iOS, and React Native applications.
Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.
                       DESC

  s.homepage         = 'https://github.com/juspay/airborne'
  s.license          = { :type => 'Apache 2.0', :file => 'LICENSE' }
  s.author           = { 
    'Juspay Technologies' => 'pp-sdk@juspay.in'
  }

  s.source       = { :http => "https://public.releases.juspay.in/release/ios/airborne/#{s.version}/Airborne.zip" }
  
  s.ios.vendored_frameworks = "Airborne.xcframework"
  s.platform     = :ios, "12.0"
end