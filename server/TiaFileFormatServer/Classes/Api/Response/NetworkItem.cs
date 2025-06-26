namespace TiaFileFormatServer.Classes.Api.Response
{
    public class NetworkItem
    {
        public string Source { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public string IpAddress { get; set; }
        public string SubnetMask { get; set; }
        public bool UseRouter { get; set; }
        public string RouterIpAddress { get; set; }
    }
}
