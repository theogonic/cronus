$crates = @("cronus_spec", "cronus_parser", "cronus_generator", "cronus_cli")

foreach ($crate in $crates) {
    Write-Host "Publishing $crate..."
    cargo publish -p "$crate"
    Start-Sleep -Seconds 5 # Wait for a few seconds to avoid rate limiting
}

Write-Host "All crates published successfully."