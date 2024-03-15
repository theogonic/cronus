crates=("cronus_spec" "cronus_parser" "cronus_generator" "cronus_cli")

for crate in "${crates[@]}"; do
    echo "Publishing $crate..."
    cargo publish -p "$crate"
    sleep 5 # Wait for a few seconds to avoid rate limiting
done

echo "All crates published successfully."