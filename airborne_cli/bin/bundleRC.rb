require 'xcodeproj'

# Get namespace from command line argument
namespace = ARGV[0] || 'default'

# Define the path to your bundle file
bundle_file_path = File.join(Dir.pwd, "ios/release_config.json")  # Update this path as needed

# Find the first Xcode project file
project_files = Dir[File.join(Dir.pwd, "ios/*.xcodeproj")]

if project_files.empty?
  puts "*** No .xcodeproj file found in current directory"
  exit 1
end

project_path = project_files[0]
puts "Found Xcode project: #{project_path}"

# Check if bundle file exists
unless File.exist?(bundle_file_path)
  puts "*** Bundle file not found: #{bundle_file_path}"
  exit 1
end

begin
  # Open the Xcode project
  project = Xcodeproj::Project.open(project_path)
  target = project.targets[0]
  puts "Using target: #{target.name}"

  # Add to the root group (main project group)
  main_group = project.main_group

  bundle_filename = File.basename(bundle_file_path)
  
  # Check if the bundle is already added to the root group
  existing_file = main_group.find_file_by_path(bundle_filename)
  
  if existing_file
    puts "Bundle '#{bundle_filename}' is already in the project"
  else
    puts "Adding bundle file: #{bundle_filename}"
    
    # Add the bundle file to the root group
    file_ref = main_group.new_file(bundle_file_path)
    
    # Add the bundle to the target's resources
    target.add_resources([file_ref])
    
    # Save the project
    project.save
    puts "Successfully added '#{bundle_filename}' to target '#{target.name}'"
  end

rescue => e
  puts "Error: #{e.message}"
  exit 1
end

puts "Done!"