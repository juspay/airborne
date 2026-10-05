-- Which file set versions a package was built from. Set versions are
-- immutable, so the referenced rows always describe what the package got.
-- packages_v2.files remains the complete expanded list used for serving.
CREATE TABLE hyperotaserver.package_file_sets (
    package_id UUID NOT NULL REFERENCES hyperotaserver.packages_v2 (id) ON DELETE CASCADE,
    file_set_id UUID NOT NULL REFERENCES hyperotaserver.file_sets (id),
    PRIMARY KEY (package_id, file_set_id)
);
