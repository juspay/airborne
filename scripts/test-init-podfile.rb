# Verify the generated CocoaPods resource hook on repeat execution, without Xcode.
require 'tmpdir'
require 'fileutils'
root = File.expand_path('..', __dir__)
Dir.mktmpdir('airborne-pod-test') do |dir|
  FileUtils.cp_r("#{root}/airborne_cli/test/fixtures/bare/.", dir)
  code = "import {initProject} from #{("#{root}/airborne_cli/src/init/project.js").inspect}; initProject(#{dir.inspect}, {organisation:'test',application:'android',endpoint:'https://example.com'});"
  abort 'init failed' unless system('node', '--input-type=module', '-e', code)
  text = File.read("#{dir}/ios/Podfile")
  hook = text[text.rindex('post_integrate do')..]
  reference = Struct.new(:path)
  phase_type = Struct.new(:files_references) do
    def add_file_reference(ref); files_references << ref; end
  end
  target_type = Struct.new(:resources_build_phase) do
    def product_type; 'com.apple.product-type.application'; end
  end
  project_type = Struct.new(:files, :native_targets, :reference_type) do
    def main_group; self; end
    def new_file(path); ref = reference_type.new(path); files << ref; ref; end
    def save; end
  end
  project = project_type.new([], [target_type.new(phase_type.new([]))], reference)
  installer = Struct.new(:aggregate_targets).new([Struct.new(:user_project).new(project)])
  receiver = Object.new
  receiver.define_singleton_method(:post_integrate) { |&block| block.call(installer) }
  2.times { receiver.instance_eval(hook) }
  abort "Duplicate resource refs: #{project.files.length}" unless project.files.length == 1
  abort 'Duplicate resources in copy phase' unless project.native_targets[0].resources_build_phase.files_references.length == 1
  puts 'Generated CocoaPods hook: repeat execution preserves one resource reference'
end
