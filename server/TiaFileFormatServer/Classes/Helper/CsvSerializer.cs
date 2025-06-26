using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;

namespace TiaFileFormatServer.Classes.Helper
{
    public class CsvSerializer
    {
        private static CsvConfiguration csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = ";",
            Quote = '"',
            ShouldQuote = (rw) => true
        };

        public static string ToCsv<T>(IEnumerable<T> data)
        {
            using (var writer = new StringWriter())
            {
                using (var csv = new CsvWriter(writer, csvConfig))
                {
                    csv.WriteRecords(data);
                }
                return writer.ToString();
            }
        }
    }
}
