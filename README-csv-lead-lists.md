# CSV Lead List Import Feature

This application now supports importing lead lists from CSV files to automatically populate website URLs for recording.

## Features

- **CSV Upload**: Import lead lists in CSV format
- **Smart Column Detection**: AI-powered analysis to identify URL columns
- **Column Selection UI**: Interactive interface to choose the correct website column
- **Dynamic Website Population**: Add websites from lead lists to your recording queue
- **Lead Source Tracking**: Recordings show when they were created from a lead list
- **Sample CSV Generator**: Download a sample CSV to see the expected format

## How to Use

### 1. Prepare Your CSV File

Your CSV file should have:
- A header row with column names
- One column containing website URLs (can be named anything)
- URLs can be in various formats:
  - `https://example.com`
  - `http://example.com`
  - `www.example.com`
  - `example.com`

### 2. Upload the CSV

1. In the "Target Websites" section, find the "Import Lead List" area
2. Click "Upload CSV" button
3. Select your CSV file

### 3. Select Website Column

After upload, you'll see a column selector showing:
- All columns from your CSV
- Sample values from each column
- Fill rate (percentage of non-empty values)
- AI recommendations for likely URL columns

Click on the column that contains your website URLs.

### 4. Use Lead List Websites

Once processed, your lead list becomes active:
- Use the dropdown to quickly add websites to your recording queue
- Mix lead list websites with manually entered URLs
- The active lead list shows filename and website count

### 5. Clear or Change Lead List

- Click "Clear" to remove the active lead list
- Upload a new CSV to replace the current list

## Sample CSV Format

Download a sample CSV using the "Download Sample CSV" link. Example format:

```csv
Company Name,Website URL,Contact Email,Industry,Location
Acme Corporation,www.acme.com,contact@acme.com,Technology,San Francisco, CA
Global Industries,https://globalindustries.io,info@globalindustries.io,Manufacturing,Chicago, IL
```

## Technical Details

### API Endpoints

- `POST /api/upload-csv` - Upload CSV file
- `POST /api/lead-lists/:id/select-column` - Select URL column
- `GET /api/lead-lists/:id/websites` - Get websites from lead list
- `GET /api/lead-lists` - List all uploaded lead lists
- `DELETE /api/lead-lists/:id` - Delete a lead list
- `GET /api/sample-csv` - Download sample CSV

### URL Processing

- Automatically adds `https://` to URLs without protocol
- Validates URL format before adding to list
- Shows errors for invalid URLs
- Preserves original row data as metadata

### Storage

- CSV files stored in `/uploads/csv/`
- Lead list data kept in memory (use database for production)
- File size limit: 10MB

## Visual Indicators

- **Green upload button**: Ready to upload
- **Green border columns**: Likely contain URLs
- **"Lead List" badge**: Shows recordings made from lead lists
- **Fill rate percentage**: Shows data completeness

## Best Practices

1. **Column Naming**: Use clear column names like "Website", "URL", "Website URL"
2. **Data Quality**: Ensure URLs are properly formatted
3. **File Size**: Keep CSV files under 10MB
4. **Regular Updates**: Upload new lead lists as needed

## Troubleshooting

### Upload Failed
- Check file is CSV format
- Verify file size is under 10MB
- Ensure file has proper headers

### No URL Columns Detected
- Check URL format in your CSV
- Make sure URLs are in a single column
- Try adding `https://` prefix to URLs

### Invalid URLs
- Review the error list after column selection
- Fix URL formatting in your source file
- Common issues: spaces, missing TLD, invalid characters