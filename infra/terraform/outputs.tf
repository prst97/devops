output "site_bucket_name" {
  description = "Final name S3 bucket (static site)"
  value       = aws_s3_bucket.site.bucket
}

output "site_bucket_endpoint" {
  description = "S3 static website endpoint"
  value       = aws_s3_bucket.site.website_endpoint
}

output "artifact_bucket_name" {
  description = "S3 bucket used by CodePipeline for artifacts"
  value       = aws_s3_bucket.artifact.bucket
}
