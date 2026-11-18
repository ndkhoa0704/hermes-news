# Chạy bằng Bun Shell (đa nền tảng): bun scripts/clean.sh
# Xoá dữ liệu sinh ra, giữ lại latest.json
echo "Dọn data/runs và data/history…"
rm -rf data/runs data/history
mkdir -p data/runs data/history
echo "Xong. Còn lại:"
ls data
