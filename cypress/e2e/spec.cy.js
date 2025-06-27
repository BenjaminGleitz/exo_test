describe('e2e', () => {
  it('passes', () => {
    cy.request('http://localhost:3000')
    cy.request('http://localhost:3000/tva?ht=100&taux=20').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.ttc).to.eq(120)
    })
    cy.request('http://localhost:3000/remise?prix=100&pourcentage=10').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.prixFinal).to.eq(90)
    })
    cy.request('http://localhost:3000/convert?from=EUR&to=USD&amount=100').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.convertedAmount).to.eq(110)
    })
  })
})