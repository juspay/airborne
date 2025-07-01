# Copyright 2025 Juspay Technologies
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AirborneReact"
  s.requires_arc = true
  s.module_name  = "AirborneReact"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "12.0"}
  s.source       = { :git => "https://github.com/juspay/airborne.git", :tag => "#{s.version}" }
  s.resource_bundles = {
    'AirborneReactResources' => ['ios/**/*.{xib,storyboard,xcassets,json}']
  }

  s.source_files = "ios/**/*.{h,m,mm,cpp}"
  s.public_header_files = "ios/**/*.h"
  s.static_framework = false

  s.dependency "Airborne", "0.0.2"

 install_modules_dependencies(s)
end
