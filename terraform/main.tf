terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }

  backend "s3" {
    bucket         = "omniswap-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "omniswap-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "OmniSwap"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ==========================================================================
# Variables
# ==========================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ==========================================================================
# VPC
# ==========================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "omniswap-${var.environment}"
  cidr = var.vpc_cidr

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # VPC Flow Logs
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true

  tags = {
    "kubernetes.io/cluster/omniswap-${var.environment}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/omniswap-${var.environment}" = "shared"
    "kubernetes.io/role/elb"                            = 1
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/omniswap-${var.environment}" = "shared"
    "kubernetes.io/role/internal-elb"                   = 1
  }
}

# ==========================================================================
# EKS Cluster
# ==========================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "omniswap-${var.environment}"
  cluster_version = "1.29"

  vpc_id                          = module.vpc.vpc_id
  subnet_ids                      = module.vpc.private_subnets
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # Node groups
  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.large"]
      
      min_size     = 2
      max_size     = 10
      desired_size = 3

      labels = {
        role = "general"
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled"                      = "true"
        "k8s.io/cluster-autoscaler/omniswap-${var.environment}" = "owned"
      }
    }

    compute = {
      name           = "compute"
      instance_types = ["c6i.xlarge"]

      min_size     = 1
      max_size     = 5
      desired_size = 2

      labels = {
        role = "compute"
      }

      taints = [{
        key    = "dedicated"
        value  = "compute"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  # OIDC for service accounts
  enable_irsa = true

  tags = {
    Environment = var.environment
  }
}

# ==========================================================================
# RDS PostgreSQL
# ==========================================================================

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "omniswap-${var.environment}"

  engine               = "postgres"
  engine_version       = "16.1"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = "db.r6g.large"

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_encrypted     = true

  db_name  = "omniswap"
  username = "omniswap_admin"
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [module.rds_security_group.security_group_id]

  maintenance_window          = "Mon:00:00-Mon:03:00"
  backup_window               = "03:00-06:00"
  backup_retention_period     = 30
  deletion_protection         = true
  skip_final_snapshot         = false
  final_snapshot_identifier_prefix = "omniswap-${var.environment}-final"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  create_monitoring_role                = true
  monitoring_interval                   = 60

  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  ]

  tags = {
    Environment = var.environment
  }
}

module "rds_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "omniswap-rds-${var.environment}"
  description = "PostgreSQL security group"
  vpc_id      = module.vpc.vpc_id

  ingress_with_source_security_group_id = [
    {
      from_port                = 5432
      to_port                  = 5432
      protocol                 = "tcp"
      source_security_group_id = module.eks.cluster_security_group_id
    }
  ]
}

# ==========================================================================
# ElastiCache Redis
# ==========================================================================

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "omniswap-${var.environment}"
  description                = "OmniSwap Redis cluster"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 2
  port                       = 6379
  parameter_group_name       = "default.redis7"
  engine_version             = "7.0"
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [module.redis_security_group.security_group_id]

  snapshot_retention_limit = 7
  snapshot_window          = "05:00-09:00"
  maintenance_window       = "mon:10:00-mon:14:00"

  tags = {
    Environment = var.environment
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "omniswap-redis-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

module "redis_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "omniswap-redis-${var.environment}"
  description = "Redis security group"
  vpc_id      = module.vpc.vpc_id

  ingress_with_source_security_group_id = [
    {
      from_port                = 6379
      to_port                  = 6379
      protocol                 = "tcp"
      source_security_group_id = module.eks.cluster_security_group_id
    }
  ]
}

# ==========================================================================
# Outputs
# ==========================================================================

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "rds_endpoint" {
  value     = module.rds.db_instance_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}