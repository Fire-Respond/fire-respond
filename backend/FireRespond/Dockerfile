# Build image untuk backend Fire Respond (dashboard BPBD + API)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY FireRespond.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish FireRespond.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
# Folder foto laporan regu
RUN mkdir -p /app/wwwroot/uploads
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "FireRespond.dll"]
