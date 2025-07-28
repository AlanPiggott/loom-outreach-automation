import { parse } from 'csv-parse';
import fs from 'fs';
import { EventEmitter } from 'events';

class CSVHandler extends EventEmitter {
    constructor() {
        super();
        this.leadLists = new Map();
    }

    async parseCSV(filePath, options = {}) {
        const { delimiter = ',', encoding = 'utf-8' } = options;
        
        return new Promise((resolve, reject) => {
            const results = [];
            let headers = null;
            let rowCount = 0;
            
            const parser = parse({
                delimiter,
                encoding,
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
                relax_column_count: true
            });

            parser.on('readable', function() {
                let record;
                while ((record = this.read()) !== null) {
                    if (!headers) {
                        headers = Object.keys(record);
                    }
                    results.push(record);
                    rowCount++;
                    
                    if (rowCount % 100 === 0) {
                        parser.emit('progress', { rowCount });
                    }
                }
            });

            parser.on('error', (err) => {
                console.error('CSV parsing error:', err);
                reject(err);
            });

            parser.on('end', () => {
                resolve({
                    headers,
                    rows: results,
                    rowCount,
                    filePath
                });
            });

            const stream = fs.createReadStream(filePath);
            stream.pipe(parser);
        });
    }

    async analyzeColumns(parsedData) {
        const { headers, rows } = parsedData;
        
        const columnAnalysis = headers.map(header => {
            const samples = rows.slice(0, 10).map(row => row[header]).filter(Boolean);
            
            const urlPatterns = [
                /^https?:\/\//i,
                /^www\./i,
                /\.(com|org|net|io|co|uk|ca|au|de|fr|es|it|nl|se|no|dk|fi|pl|ru|br|mx|ar|cl|pe|co|za|eg|ng|ke|ma|tn|gh|et|ug|tz|mz|mg|ao|zm|zw|bw|na|sz|ls|mw|rw|bi|dj|so|er|sd|ss|ly|td|cf|cg|cd|cm|gq|ga|st|gn|gw|lr|sl|tg|bj|ml|bf|ne|sn|gm|mr|cv|ci|gh|tg|bj|ml|bf|ne|sn|gm|mr|cv)$/i
            ];
            
            const likelyUrl = samples.some(sample => 
                urlPatterns.some(pattern => pattern.test(sample))
            );
            
            const emptyCount = rows.filter(row => !row[header] || row[header].trim() === '').length;
            const fillRate = ((rows.length - emptyCount) / rows.length * 100).toFixed(1);
            
            return {
                name: header,
                samples: samples.slice(0, 5),
                likelyUrl,
                fillRate: parseFloat(fillRate),
                emptyCount
            };
        });
        
        const urlColumns = columnAnalysis.filter(col => col.likelyUrl);
        const recommendedColumn = urlColumns.length > 0 
            ? urlColumns.reduce((a, b) => a.fillRate > b.fillRate ? a : b).name
            : null;
        
        return {
            columns: columnAnalysis,
            urlColumns,
            recommendedColumn
        };
    }

    extractWebsites(parsedData, columnName) {
        const { rows } = parsedData;
        const websites = [];
        const errors = [];
        
        rows.forEach((row, index) => {
            const value = row[columnName];
            if (!value || value.trim() === '') {
                return;
            }
            
            let url = value.trim();
            
            if (!url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
            }
            
            try {
                const urlObj = new URL(url);
                websites.push({
                    url: urlObj.href,
                    originalValue: value,
                    rowIndex: index + 1,
                    metadata: row
                });
            } catch (error) {
                errors.push({
                    rowIndex: index + 1,
                    value,
                    error: error.message
                });
            }
        });
        
        return {
            websites,
            errors,
            totalRows: rows.length,
            successCount: websites.length,
            errorCount: errors.length
        };
    }

    saveLeadList(id, data) {
        this.leadLists.set(id, {
            ...data,
            created: new Date(),
            lastAccessed: new Date()
        });
    }

    getLeadList(id) {
        const leadList = this.leadLists.get(id);
        if (leadList) {
            leadList.lastAccessed = new Date();
        }
        return leadList;
    }

    getAllLeadLists() {
        return Array.from(this.leadLists.entries()).map(([id, data]) => ({
            id,
            fileName: data.fileName,
            rowCount: data.parsedData.rowCount,
            selectedColumn: data.selectedColumn,
            websiteCount: data.extractedData.successCount,
            created: data.created,
            lastAccessed: data.lastAccessed
        }));
    }

    deleteLeadList(id) {
        return this.leadLists.delete(id);
    }

    generateSampleCSV() {
        const headers = ['Company Name', 'Website URL', 'Contact Email', 'Industry', 'Location'];
        const rows = [
            ['Acme Corporation', 'www.acme.com', 'contact@acme.com', 'Technology', 'San Francisco, CA'],
            ['Global Industries', 'https://globalindustries.io', 'info@globalindustries.io', 'Manufacturing', 'Chicago, IL'],
            ['StartupXYZ', 'startupxyz.com', 'hello@startupxyz.com', 'SaaS', 'Austin, TX'],
            ['Enterprise Solutions', 'https://www.enterprise-solutions.net', 'sales@enterprise-solutions.net', 'Consulting', 'New York, NY'],
            ['Innovation Labs', 'innovationlabs.co', 'team@innovationlabs.co', 'Research', 'Boston, MA']
        ];
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }
}

export default new CSVHandler();