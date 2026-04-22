#!/bin/bash

echo "🧪 TEST COMPLET DU SYSTÈME MARIEM'S SWEET KITCHEN"
echo "=================================================="

# Couleurs pour les tests
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "Testing $name... "
    
    if [ -n "$expected_status" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        if [ "$status" = "$expected_status" ]; then
            echo -e "${GREEN}✅ PASS${NC} (Status: $status)"
            return 0
        else
            echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status)"
            return 1
        fi
    else
        response=$(curl -s "$url")
        if [ $? -eq 0 ] && [ -n "$response" ]; then
            echo -e "${GREEN}✅ PASS${NC}"
            return 0
        else
            echo -e "${RED}❌ FAIL${NC}"
            return 1
        fi
    fi
}

# Fonction pour tester un endpoint JSON
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local field="$3"
    
    echo -n "Testing $name... "
    
    response=$(curl -s "$url")
    if [ $? -eq 0 ] && echo "$response" | jq -e "$field" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

echo ""
echo "1. 🔍 Vérification des services Docker..."
echo "----------------------------------------"
docker-compose ps

echo ""
echo "2. 🌐 Test des endpoints API..."
echo "-------------------------------"

# Test Backend Health
test_endpoint "Backend Health" "http://localhost:3001/api/health" "200"

# Test Seed Database
test_json_endpoint "Database Seed" "http://localhost:3001/api/seed" ".success"

# Test Recipes API
test_json_endpoint "Recipes API" "http://localhost:3001/api/recipes" ".data"

# Test Ingredients API
test_json_endpoint "Ingredients API" "http://localhost:3001/api/ingredients" ".data"

echo ""
echo "3. 🎨 Test du Frontend..."
echo "-------------------------"

# Test Frontend
test_endpoint "Frontend" "http://localhost:3000" "200"

echo ""
echo "4. 🗄️ Test de la base de données..."
echo "-----------------------------------"

# Test MongoDB
echo -n "Testing MongoDB connection... "
if docker exec mariem-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test des données
echo -n "Testing MongoDB data... "
recipe_count=$(docker exec mariem-mongodb mongosh -u admin -p password123 --authenticationDatabase admin mariem_kitchen --eval "db.recipes.countDocuments()" --quiet 2>/dev/null | tail -1)
if [ "$recipe_count" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} ($recipe_count recipes found)"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo ""
echo "5. 📊 Résumé des tests..."
echo "-------------------------"

# Compter les tests réussis
total_tests=7
passed_tests=0

# Backend Health
if curl -s http://localhost:3001/api/health | jq -e '.success' > /dev/null 2>&1; then
    ((passed_tests++))
fi

# Database Seed
if curl -s -X POST http://localhost:3001/api/seed | jq -e '.success' > /dev/null 2>&1; then
    ((passed_tests++))
fi

# Recipes API
if curl -s http://localhost:3001/api/recipes | jq -e '.data' > /dev/null 2>&1; then
    ((passed_tests++))
fi

# Ingredients API
if curl -s http://localhost:3001/api/ingredients | jq -e '.data' > /dev/null 2>&1; then
    ((passed_tests++))
fi

# Frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    ((passed_tests++))
fi

# MongoDB
if docker exec mariem-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    ((passed_tests++))
fi

# MongoDB Data
if [ "$recipe_count" -gt 0 ]; then
    ((passed_tests++))
fi

echo "Tests réussis: $passed_tests/$total_tests"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "${GREEN}🎉 TOUS LES TESTS SONT PASSÉS !${NC}"
    echo -e "${GREEN}Le système est opérationnel et prêt à être utilisé.${NC}"
else
    echo -e "${YELLOW}⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.${NC}"
fi

echo ""
echo "🌐 URLs d'accès:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:3001/api"
echo "  - MongoDB: localhost:27017"
echo ""
echo "📚 Documentation:"
echo "  - API Health: http://localhost:3001/api/health"
echo "  - Recipes: http://localhost:3001/api/recipes"
echo "  - Ingredients: http://localhost:3001/api/ingredients"
