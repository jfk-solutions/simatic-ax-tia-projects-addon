namespace TiaFileFormatServer.Classes.Api.Response
{
    public class Folder
    {
        public string Name { get; set; }
        public long Id { get; set; }
        public List<Folder> Children { get; set; }
        public string Additional { get; set; }
    }
}
